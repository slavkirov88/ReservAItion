# Clock PMS+ интеграция - план за изпълнение (Спринт 1)

> **За агентни работници:** ЗАДЪЛЖИТЕЛНО ПОД-УМЕНИЕ: използвай superpowers:subagent-driven-development (препоръчано) или superpowers:executing-plans, за да изпълниш този план задача по задача. Стъпките са с чекбокс (`- [ ]`) за проследяване.

**Goal:** Гласовият агент чете реална наличност от Clock PMS+ през локален кеш и създава истинска резервация в PMS-а, видима в техния интерфейс.

**Architecture:** Нов слой `src/lib/inventory/` с два доставчика зад един интерфейс. `own` обвива днешния код и не променя поведението за съществуващите наематели. `clock` чете от таблица-кеш и пише през REST клиента, пренесен от StayDesk. Кешът се пълни от отделна крайна точка, която за Спринт 1 се вика ръчно (виж Task 7). Маршрутът на Vapi инструментите не знае кой доставчик стои отзад.

**Tech Stack:** Next.js 16 App Router, TypeScript, Supabase (Postgres), Jest + ts-jest (`npm test`), Vapi.

**Спек:** `docs/superpowers/specs/2026-08-30-clock-pms-integration-design.md`
**Клон:** `feature/clock-integration`

---

## Структура на файловете

| Файл | Отговорност |
|---|---|
| `src/lib/clock/client.ts` | Транспорт: digest, ограничител, повторни опити, грешки. Пренесен от StayDesk. |
| `src/lib/clock/client.test.ts` | Тестове на digest хедъра и правилата за повторен опит. |
| `src/lib/clock/voice.ts` | Четирите извиквания, които voice потребителят има право да прави. |
| `src/lib/clock/config.ts` | Чете блока `clock` от `tenants.settings`. |
| `src/lib/clock/availability-map.ts` | Чиста функция: отговор на `rates_availability` → редове за кеша. |
| `src/lib/clock/availability-map.test.ts` | Тестове на картографирането. |
| `src/lib/clock/booking-body.ts` | Чиста функция: сглобява тялото на `booking` CREATE. |
| `src/lib/clock/booking-body.test.ts` | Тестове, включително че `main_booking_guest` е на горно ниво. |
| `src/lib/inventory/types.ts` | `InventoryProvider`, `RoomOffer`, `BookingRequest`, `BookingResult`, `GuestCount`. |
| `src/lib/inventory/own.ts` | Днешното поведение зад интерфейса. |
| `src/lib/inventory/clock.ts` | Кеш + Clock зад интерфейса. |
| `src/lib/inventory/index.ts` | `getInventory` избира доставчика. |
| `src/lib/inventory/format-bg.ts` | Български текст за агента, включително причината при рестрикция. |
| `src/lib/inventory/format-bg.test.ts` | Тестове на текста. |
| `src/app/api/cron/clock-availability/route.ts` | Пълни кеша. Вика се ръчно за Спринт 1, виж Task 7. |
| `src/app/api/vapi/[tenantId]/tool-call/route.ts` | Модифициран: минава през `getInventory`. |
| `supabase/migrations/011_clock_integration.sql` | `tenants.settings`, кеш таблица, лог на резервациите. |
| `src/types/database.ts` | Модифициран: `TenantRow.settings` и двете нови таблици в картата `Database`. |
| `src/lib/clock/children-ages.ts` | Чиста функция: „5 и 8 години" → `[5, 8]` за техните параметри. |
| `src/lib/clock/children-ages.test.ts` | Тестове на преобразуването, включително заблуждаващи числа. |
| `scripts/clock-voice-probe.mjs` | Ръчна проверка срещу sandbox. |

---

## Task 0: Подготовка на клона

**Files:** няма нови

- [ ] **Стъпка 1: Увери се, че си на правилния клон**

```bash
cd "C:/Users/mariy/Documents/Projects/ReservAItion"
git branch --show-current   # очаква се: feature/clock-integration
git status --porcelain      # очаква се: празно
```

- [ ] **Стъпка 2: Влей разделянето на гостите**

Спекът, раздел 7: Clock има нативни `adults` и `children`, а `rates_availability` смята цената грешно без тях. Работата вече е написана.

```bash
git merge --no-ff feature/guest-breakdown -m "merge: guest breakdown, needed for Clock adults/children"
```

- [ ] **Стъпка 3: Провери, че тестовете още минават**

Run: `npm test`
Expected: PASS, без нови провали.

- [ ] **Стъпка 4: Комит (само ако merge-ът е оставил конфликти за оправяне)**

---

## Task 1: Миграция на схемата

**Files:**
- Create: `supabase/migrations/011_clock_integration.sql`

- [ ] **Стъпка 1: Напиши миграцията**

```sql
-- 011_clock_integration.sql
-- Per-tenant Clock PMS+ wiring: credentials on the row, a cache for their
-- heaviest endpoint, and a log that keeps a repeated tool call from creating
-- the same booking twice.

ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS settings jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Clock's own guidance: rates_availability "consumes a highest amount of
-- application resources", refresh every 15-20 minutes and cache on our side.
-- The voice agent never calls it during a conversation.
CREATE TABLE IF NOT EXISTS clock_availability_cache (
  tenant_id           uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  clock_room_type_id  integer NOT NULL,
  room_type_name      text,
  clock_rate_id       integer NOT NULL,
  date                date NOT NULL,
  free                boolean NOT NULL DEFAULT false,
  price_cents         integer,
  currency            text,
  free_rooms          integer,
  min_stay            integer,
  closed_for_arrival  boolean NOT NULL DEFAULT false,
  stop_from_sale      boolean NOT NULL DEFAULT false,
  fetched_at          timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, clock_room_type_id, clock_rate_id, date)
);

CREATE INDEX IF NOT EXISTS clock_availability_cache_lookup
  ON clock_availability_cache (tenant_id, date);

-- Vapi retries a tool call it thinks timed out. Without this the guest gets
-- two bookings in the hotel's PMS and we find out from the hotel.
CREATE TABLE IF NOT EXISTS clock_booking_log (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  vapi_call_id      text NOT NULL,
  clock_booking_id  text,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS clock_booking_log_call
  ON clock_booking_log (tenant_id, vapi_call_id);

ALTER TABLE clock_availability_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE clock_booking_log ENABLE ROW LEVEL SECURITY;
-- Both tables are written only by the service role (cron and the tool-call
-- route). No policy is added on purpose: RLS on with no policy denies the
-- anon and authenticated roles outright.
```

- [ ] **Стъпка 2: Приложи в Supabase**

Отвори SQL Editor на проекта и изпълни файла. Провери:

```sql
select column_name from information_schema.columns
where table_name = 'tenants' and column_name = 'settings';
```
Expected: един ред.

- [ ] **Стъпка 3: Обнови типовете на ръка**

⚠️ `src/types/database.ts` **не е генериран**. Той е ръчно поддържан и `src/lib/supabase/server.ts` подава `createServerClient<Database>`. Ако новите таблици не влязат в картата `Database`, всяко `.from('clock_availability_cache')` пада на компилация. Същият файл се пипа и в `feature/guest-breakdown`, така че прецедентът е в клона, който току-що вля.

Добави:

⚠️ `TenantUpdate` е **производен**: `Partial<Omit<TenantInsert, 'id'>>` (`database.ts:296`). Не се пипа директно. Добави полето в `TenantRow` и в `TenantInsert`, и то се появява само.

```ts
// в TenantRow (задължително) и в TenantInsert (по избор)
settings: Record<string, unknown>
settings?: Record<string, unknown>

// нови редови типове
export type ClockAvailabilityCacheRow = {
  tenant_id: string
  clock_room_type_id: number
  room_type_name: string | null
  clock_rate_id: number
  date: string
  free: boolean
  price_cents: number | null
  currency: string | null
  free_rooms: number | null
  min_stay: number | null
  closed_for_arrival: boolean
  stop_from_sale: boolean
  fetched_at: string
}

export type ClockBookingLogRow = {
  id: string
  tenant_id: string
  vapi_call_id: string
  clock_booking_id: string | null
  created_at: string
}

// в Database.public.Tables
// Insert е с незадължителен fetched_at и незадължителни булеви: базата им дава
// стойност по подразбиране, а toCacheRows не бива да ги попълва напразно.
clock_availability_cache: {
  Row: ClockAvailabilityCacheRow
  Insert: Omit<ClockAvailabilityCacheRow, 'fetched_at'> & { fetched_at?: string }
  Update: Partial<ClockAvailabilityCacheRow>
  Relationships: []
}
clock_booking_log: { Row: ClockBookingLogRow; Insert: Omit<ClockBookingLogRow, 'id' | 'created_at'>; Update: Partial<ClockBookingLogRow>; Relationships: [] }
```

- [ ] **Стъпка 4: Провери, че компилира**

Run: `npx tsc --noEmit`
Expected: без нови грешки.

- [ ] **Стъпка 5: Комит**

```bash
git add supabase/migrations/011_clock_integration.sql src/types/database.ts
git commit -m "feat: schema for Clock tenant config, availability cache and booking log"
```

---

## Task 2: Пренасяне на Clock клиента

Източник: `C:/Users/mariy/Desktop/AIOS/StayDesk/lib/clock/client.ts` и `client` частта от неговите тестове. Пренася се транспортът, не бизнес логиката за престои.

**Files:**
- Create: `src/lib/clock/client.ts`
- Create: `src/lib/clock/client.test.ts`

- [ ] **Стъпка 1: Копирай транспортната част**

Взимат се: `ClockCredentials`, `ClockRequestOptions`, `ClockError`, `ClockBannedError`, `RATE_LIMIT_PER_SECOND`, `resetRateLimiter`, `parseDigestChallenge`, `buildDigestHeader`, `clockGet`, плюс модулно-частните `waitForSlot`, `md5`, `sleep` и `recentCalls`.

⚠️ `waitForSlot` е частна за модула. Копира се, но **не** се експортира и не се тества директно.

**Не** се взимат: `ClockRoom`, `ClockBooking`, `listRooms`, `listBookingIds`, `getBooking`, `listCheckedInBookingIds`, `listBookingIdsUpdatedSince`. Това са правата на `staydesk_guest`, не на `staydesk_voice`. Пренасянето им би било код, който няма право да се изпълни.

Запази коментара най-горе дословно. Той обяснява защо `500` не се повтаря и защо `403` спира всичко, а това е точно знанието, което се губи при пренаписване.

- [ ] **Стъпка 2: Добави `clockPost`**

`clockGet` не стига, защото `booking` CREATE е POST. Същото ръкостискане, същият ограничител, същите правила за повторен опит, различен метод и тяло.

```ts
export async function clockPost<T = unknown>(
  creds: ClockCredentials,
  path: string,
  body: unknown,
  options: ClockRequestOptions = {},
): Promise<T>
```

⚠️ Повторният опит при POST е **само** при мрежов срив преди отговор. Не и при `429`: не знаем дали резервацията е минала, а двойна резервация в чужд PMS е по-скъпа от една неуспешна.

- [ ] **Стъпка 2б: Раздели двата вида `403`**

🔴 Пренесеният клиент обявява **всеки** `403` за бан от WAF. Това е грешно и го доказах на живо на 30.08: guest потребителят върна

```
403 {"error":"The User doesn't have pms_api_rates_availability_show right"}
```

Липсващо право, не бан. Ако това стигне до нас като „чакай два часа", ще гоним несъществуващ проблем половин ден.

Добави `ClockForbiddenError` и разделяй по тялото: съдържа ли `right`, това е право, иначе е бан. Тест и за двата случая.

⚠️ Същата поправка трябва да отиде и обратно в StayDesk, където клиентът е роден. Запиши го като задача там, не го прави в този спринт.

- [ ] **Стъпка 3: Напиши тестовете**

```ts
import { parseDigestChallenge, buildDigestHeader, resetRateLimiter } from './client'

beforeEach(() => resetRateLimiter())

test('parses a digest challenge with quoted and bare fields', () => {
  const fields = parseDigestChallenge('Digest realm="clock", qop=auth, nonce="abc", stale=false')
  expect(fields.realm).toBe('clock')
  expect(fields.qop).toBe('auth')
  expect(fields.nonce).toBe('abc')
})

test('digest header carries the user and the uri', () => {
  const header = buildDigestHeader({
    challenge: { realm: 'clock', nonce: 'abc', qop: 'auth' },
    method: 'GET',
    uri: '/pms_api/1/2/rooms/',
    username: 'u',
    password: 'k',
    cnonce: 'fixed-for-the-test',
  })
  expect(header).toContain('username="u"')
  expect(header).toContain('uri="/pms_api/1/2/rooms/"')
  expect(header).toContain('response=')
})
```

⚠️ `cnonce` е задължителен и няма стойност по подразбиране. В теста се подава фиксиран, за да е повторим резултатът.

⚠️ `uri` включва и query частта. Тя влиза в хеша HA2, така че изпусната query дава `401`, който изглежда като грешен ключ. Този коментар е в пренесения файл, не го махай.

- [ ] **Стъпка 4: Пусни тестовете**

Run: `npm test -- src/lib/clock/client.test.ts`
Expected: PASS

- [ ] **Стъпка 5: Комит**

```bash
git add src/lib/clock/client.ts src/lib/clock/client.test.ts
git commit -m "feat: port Clock PMS+ transport client from StayDesk

Digest auth, a 5-per-second limiter, retries only on 429 and transport
failure, and a 403 that stops everything because their WAF bans for two
hours. Only the transport crosses over: the booking and room readers belong
to the guest API user, and this project authenticates as the voice one."
```

---

## Task 3: Конфигурация на наемателя

**Files:**
- Create: `src/lib/clock/config.ts`

- [ ] **Стъпка 1: Напиши четенето**

```ts
import type { SupabaseClient } from '@supabase/supabase-js'
import type { ClockCredentials } from './client'

export interface ClockTenantConfig {
  tenantId: string
  creds: ClockCredentials
  rateIds: number[]
  sandbox: boolean
}

/**
 * Credentials live on the tenant row, not in the environment.
 *
 * Every hotel has its own Clock subscription and API user, so a shared env
 * var cannot address them. StayDesk already paid for this lesson with a
 * global chat id that sent one hotel's requests into another hotel's group.
 */
export async function loadClockConfig(
  supabase: SupabaseClient,
  tenantId: string,
): Promise<ClockTenantConfig | null> {
  const { data } = await supabase
    .from('tenants').select('id, settings').eq('id', tenantId).maybeSingle()
  if (!data) return null

  const clock = (data.settings as Record<string, any> | null)?.clock
  // A partial block means "not connected", not "broken".
  if (!clock?.base_url || !clock.api_user || !clock.api_key) return null

  return {
    tenantId: String(data.id),
    creds: { baseUrl: clock.base_url, apiUser: clock.api_user, apiKey: clock.api_key },
    rateIds: Array.isArray(clock.rate_ids) ? clock.rate_ids : [],
    sandbox: clock.sandbox !== false,
  }
}

/** Guard: while sandbox is on, nothing may be written to a production host. */
export function assertWritable(config: ClockTenantConfig): void {
  if (config.sandbox && !config.creds.baseUrl.includes('sky-eu1')) {
    throw new Error('Clock config is marked sandbox but base_url is not the sandbox host')
  }
}
```

- [ ] **Стъпка 2: Комит**

```bash
git add src/lib/clock/config.ts
git commit -m "feat: per-tenant Clock config read from tenants.settings"
```

---

## Task 4: Четирите извиквания на voice потребителя

**Files:**
- Create: `src/lib/clock/voice.ts`

- [ ] **Стъпка 1: Напиши ги**

Точните контракти са от публикуваната Postman колекция, раздел 12 на спека.

```ts
import { clockGet, clockPost, type ClockCredentials } from './client'

/** GET /rates_availability/?from=&to=&rates=&room_types=&adults=&children= */
export async function getRatesAvailability(
  creds: ClockCredentials,
  args: { from: string; to: string; rateIds: number[]; adults?: number; children?: number; childrenAges?: number[] },
) { /* ... */ }

/** GET /products?product_search[arrival]=&[departure]=&rates[]=&[adult_count]=&[children_count]= */
export async function getProducts(
  creds: ClockCredentials,
  args: { arrival: string; departure: string; rateIds: number[]; adults?: number; children?: number; childrenAges?: number[] },
) { /* ... */ }

/** GET /guests/search?free_text_search= (matches e_mail, phone_number, first_name, last_name) */
export async function searchGuests(creds: ClockCredentials, freeText: string) { /* ... */ }

/** POST /bookings/ */
export async function createBooking(creds: ClockCredentials, body: unknown) { /* ... */ }
```

**Проверено срещу sandbox-а на 30.08. Не гадай, използвай тези низове.**

```
GET /rates_availability/?from=2026-09-06&to=2026-09-13&rates[]=799198&room_types[]=42414
    &adults=2&children=1&children_ages[]=5                                   -> 200

GET /products?product_search[arrival]=2026-09-06&product_search[departure]=2026-09-13
    &rates[]=799198&product_search[adult_count]=2&product_search[children_count]=1
    &product_search[children_ages][]=5                                       -> 200

GET /guests/search?free_text_search=abc                                      -> 200
```

⚠️ **`room_types` е ЗАДЪЛЖИТЕЛЕН за `rates_availability`.** Документацията му го изброява като „Selected Rooms **or** Room Types", без да го маркира като задължителен. Без него идва `400` с `contract.filled?` и нищо повече. Струва половин час, ако не го знаеш.

⚠️ **`children_ages` е масив.** `children_ages=5` дава `400` с `children_ages.array?`. Правилното е `children_ages[]=5`, а при `products` е `product_search[children_ages][]=5`.

⚠️ Параметрите на `products` са с квадратни скоби в името. Кодирай ги, не ги „оправяй".

⚠️ `guests/search` иска **минимум 3 символа**. По-късо връща `500`, не `400`. Значи търсенето по телефон е наред, но по кратко име не е, и кодът трябва да го пази.

⚠️ `adults`, `children` и `children_ages` се подават и на `rates_availability`, и на `products`. Без тях цената при тарифи „на човек" се смята грешно. Това е записано в тяхната документация, не е предположение.

- [ ] **Стъпка 2: Преобразуване на възрастите**

Нашата колона `children_ages` е **текст** (`010_guest_breakdown.sql`), защото агентът я чува като „5 и 8 години". Техните параметри искат **числа**. Шевът трябва да съществува, иначе цената пак се смята грешно, само че тихо.

Тест първо, `src/lib/clock/children-ages.test.ts`:

```ts
import { parseChildrenAges } from './children-ages'

test('pulls numbers out of what the agent heard', () => {
  expect(parseChildrenAges('5 и 8 години')).toEqual([5, 8])
  expect(parseChildrenAges('на 3')).toEqual([3])
})

test('empty input gives an empty list, not a zero', () => {
  expect(parseChildrenAges(null)).toEqual([])
  expect(parseChildrenAges('')).toEqual([])
})

test('ignores numbers that cannot be a child age', () => {
  expect(parseChildrenAges('2026 година, детето е на 4')).toEqual([4])
})
```

Последният тест е важен: агентът понякога вплита година в изречението, а възраст над 17 не е дете.

- [ ] **Стъпка 3: Комит**

```bash
git add src/lib/clock/voice.ts src/lib/clock/children-ages.*
git commit -m "feat: the four Clock calls the voice API user is allowed to make"
```

---

## Task 5: Интерфейсът и доставчикът own

**Files:**
- Create: `src/lib/inventory/types.ts`
- Create: `src/lib/inventory/own.ts`
- Create: `src/lib/inventory/own.test.ts`

- [ ] **Стъпка 1: Напиши типовете**

```ts
export interface GuestCount { adults: number | null; children: number | null; childrenAges: string | null }

export interface RoomOffer {
  id: string                 // наш uuid или Clock room_type_id като низ
  name: string
  pricePerNight: number      // цяла единица, не стотинки
  currency: string           // 'EUR' за own, 'BGN' в Clock sandbox-а. Никога не се приема наум.
  availableRooms: number
  capacity?: number
  restriction?: string       // защо не става, ако не става
}

export interface BookingRequest {
  guestName: string
  guestPhone: string
  guestEmail: string | null
  checkIn: string
  checkOut: string
  roomTypeRef: string
  guests: GuestCount
  callId: string | null
}

export interface BookingResult {
  ok: boolean
  ref: string | null
  source: 'own' | 'clock'
  spokenResult: string       // какво да каже агентът, на български
}

export interface InventoryProvider {
  availability(checkIn: string, checkOut: string, guests: GuestCount): Promise<RoomOffer[]>
  createBooking(req: BookingRequest): Promise<BookingResult>
}
```

- [ ] **Стъпка 2: Напиши теста за регресия ПРЕДИ кода**

Целта е да докажеш, че съществуващите наематели не усещат нищо.

```ts
test('own provider maps todays availability shape to RoomOffer', () => {
  const offers = toOffers([
    { id: 'uuid-1', name: 'Студио', description: null, capacity: 2,
      price_per_night: 88, total_rooms: 3, available_rooms: 2 },
  ])
  expect(offers[0]).toEqual({ id: 'uuid-1', name: 'Студио', pricePerNight: 88, currency: 'EUR', availableRooms: 2, capacity: 2 })
})
```

- [ ] **Стъпка 3: Пусни го, увери се, че пада**

Run: `npm test -- src/lib/inventory/own.test.ts`
Expected: FAIL, `toOffers` не съществува.

- [ ] **Стъпка 4: Напиши `own.ts`, експортирай `makeOwnProvider`**

`availability()` обвива `getAvailableRoomTypes` от `src/lib/availability.ts`.

Подписът е `makeOwnProvider(supabase, tenantId, deps?)`. **Третият аргумент е по избор**, защото Task 11 го вика с два.

`createBooking()` пренася **целия** клон `send_booking_inquiry`, а не само вмъкването в базата. Той прави три неща:

1. търси типа стая по име с `ilike`
2. вмъква реда в `reservations`
3. вика `sendOwnerNotification` към собственика на обекта

⚠️ Номерата на редовете тук нарочно ги няма: след merge-а в Task 0 клонът се измества с около шест реда. Търси по име на функцията, не по номер.

⚠️ Ако се премести само вмъкването, съществуващите наематели **тихо спират да получават имейл** при ново запитване. Това е точно видът регресия, която се забелязва седмица по-късно от клиент, не от тест.

- [ ] **Стъпка 5: Тест за пътя на резервацията**

```ts
test('own createBooking notifies the owner and inserts the row', async () => {
  const supabase = fakeSupabase()          // хваща from().insert()
  const notify = jest.fn()
  const provider = makeOwnProvider(supabase, 'tenant-1', { notify })

  const result = await provider.createBooking({ /* ... */ })

  expect(supabase.inserted('reservations')).toHaveLength(1)
  expect(notify).toHaveBeenCalledTimes(1)
  expect(result.ok).toBe(true)
})
```

`sendOwnerNotification` се подава като зависимост, за да е тестваем без Resend. Ако това усложни кода повече от полза, вместо това го мокни с `jest.mock('@/lib/email/resend')`.

- [ ] **Стъпка 6: Пусни тестовете**

Run: `npm test -- src/lib/inventory`
Expected: PASS

- [ ] **Стъпка 7: Комит**

```bash
git add src/lib/inventory/
git commit -m "feat: inventory provider interface and the own-inventory implementation

createBooking carries the whole existing branch across, owner notification
included. Moving only the insert would have stopped the emails silently."
```

---

## Task 6: Картографиране на кеша

**Files:**
- Create: `src/lib/clock/availability-map.ts`
- Create: `src/lib/clock/availability-map.test.ts`

- [ ] **Стъпка 1: Напиши тестовете ПЪРВО**

```ts
import { toCacheRows } from './availability-map'

const sample = { /* съкратен истински отговор на rates_availability */ }

test('keeps the price in cents and the currency', () => {
  const rows = toCacheRows('tenant-1', sample)
  expect(rows[0].price_cents).toBe(8800)
  expect(rows[0].currency).toBe('EUR')
})

test('a stop_from_sale day is not free even when rooms are left', () => {
  const rows = toCacheRows('tenant-1', { /* free: false, stop_from_sale: true, room_type_free_rooms: 3 */ })
  expect(rows[0].free).toBe(false)
  expect(rows[0].stop_from_sale).toBe(true)
})

test('min_stay is carried through so the agent can say why', () => {
  const rows = toCacheRows('tenant-1', { /* rate_restriction: { min_stay: 2 } */ })
  expect(rows[0].min_stay).toBe(2)
})
```

**Фикстурата вече съществува:** `docs/superpowers/fixtures/rates_availability.json`, свалена от sandbox-а на 30.08. Формата е вложена три нива:

```
[ { type: "Pms::RoomType", id: 42416, rates: {
      "799198": { "2026-09-06": {
          free: true,
          price: { currency: "BGN", cents: 8000 },
          room_type_free_rooms: 24,
          errors: null,
          rate_restriction: { min_stay: null, close_for_arrival: false, stop_from_sale: false, ... }
      } } } } ]
```

🔴 **Валутата е BGN, не EUR.** Цените в нашата собствена база са в евро, а Clock връща стотинки в лева. `toCacheRows` записва `currency` както е дошла и **не превръща нищо**. Форматиращата функция казва валутата, която е получила. Агент, който каже „осемдесет евро" за стая от 80 лева, е по-лош от агент, който мълчи.

Задължителен тест:

```ts
test('carries the currency through instead of assuming euro', () => {
  const rows = toCacheRows('tenant-1', fixture)
  expect(rows[0].currency).toBe('BGN')
  expect(rows[0].price_cents).toBe(8000)
})
```

- [ ] **Стъпка 2: Пусни, увери се, че падат**

Run: `npm test -- src/lib/clock/availability-map.test.ts`
Expected: FAIL

- [ ] **Стъпка 3: Напиши `toCacheRows`**

Чиста функция, без Supabase, без мрежа. Влиза отговорът, излизат редове за upsert.

- [ ] **Стъпка 4: Пусни тестовете**

Expected: PASS

- [ ] **Стъпка 5: Комит**

```bash
git add src/lib/clock/availability-map.*
git commit -m "feat: map a rates_availability response into cache rows"
```

---

## Task 7: Cron за пълнене на кеша

**Files:**
- Create: `src/app/api/cron/clock-availability/route.ts`
- ⛔ **`vercel.json` НЕ се пипа.** Виж стъпка 2.

- [ ] **Стъпка 1: Напиши маршрута**

За всеки наемател с блок `clock`: `getRatesAvailability` от днес до днес + 90 дни, `toCacheRows`, upsert.

Автентикацията е точно както при другите два крона в проекта, не измисляй трета:

```ts
const authHeader = request.headers.get('authorization')
if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}
```

- [ ] **Стъпка 2: НЕ регистрирай cron във `vercel.json`**

⛔ `vercel.json` вече съдържа **два** крона (`expire-deposits` и `sync-ical`), а Hobby планът дава точно толкова. Трети запис проваля деплоя. Отделно Hobby разрешава само дневно разписание, така че 15-минутният ритъм от спека е недостижим на този план при всички случаи (виж комит `f24b809`).

За Спринт 1 кешът се пълни **ръчно** преди демото:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://reservaition.io/api/cron/clock-availability
```

Ако някога трябва да е автоматично, изборът е между платен план и външен планировчик (n8n вече върти при нас на 10 минути за друго). Това е решение за пилотния хотел, не за този спринт.

- [ ] **Стъпка 3: Провери го локално**

Run: `npm run dev`, после curl-ни маршрута с правилния хедър.
Expected: `200` и брой записани редове в отговора.

- [ ] **Стъпка 4: Комит**

```bash
git add src/app/api/cron/clock-availability/route.ts
git commit -m "feat: endpoint that refills the Clock availability cache

Not registered in vercel.json: the Hobby plan allows two crons and both
slots are taken, and it only schedules daily anyway. Called by hand before
the demo; the pilot hotel gets a real scheduler."
```

---

## Task 8: Доставчикът clock, четене

**Files:**
- Create: `src/lib/inventory/clock.ts`
- Create: `src/lib/inventory/format-bg.ts`
- Create: `src/lib/inventory/format-bg.test.ts`

**Решение, което не бива да се остави на импровизация:** и двата доставчика минават през **една** форматираща функция, `formatOffersBg`, върху `RoomOffer[]`.

⛔ Старата `formatAvailabilityBg` в `src/lib/availability.ts` **не се трие.** Освен маршрута на Vapi, тя се вика и от чат уиджета (`src/app/api/chat/[apiKey]/route.ts:141`), който този спринт не пипа. Само маршрутът на Vapi спира да я вика.

⚠️ Това означава, че текстът, който чува гостът на живото демо, минава през нов код. Затова първият тест е златен: `formatOffersBg` трябва да върне **дословно** същия низ, който днешната функция връща за същите данни, когато няма рестрикции.

- [ ] **Стъпка 1: Тестове за българския текст**

```ts
import { formatAvailabilityBg } from '@/lib/availability'
import { formatOffersBg } from './format-bg'

test('matches todays wording exactly when nothing is restricted', () => {
  const legacy = formatAvailabilityBg(
    [{ id: 'a', name: 'Студио', description: null, capacity: 2,
       price_per_night: 88, total_rooms: 3, available_rooms: 2 }],
    '2026-09-12', '2026-09-14',
  )
  const next = formatOffersBg(
    [{ id: 'a', name: 'Студио', pricePerNight: 88, currency: 'EUR', availableRooms: 2, capacity: 2 }],
    '2026-09-12', '2026-09-14',
  )
  expect(next).toBe(legacy)
})

test('says the reason when a restriction blocks the dates', () => {
  const text = formatOffersBg([{ id: '1', name: 'Двойна', pricePerNight: 120, currency: 'BGN', availableRooms: 0, restriction: 'min_stay:2' }], '2026-09-12', '2026-09-13')
  expect(text).toContain('минималният престой')
  expect(text).toContain('2')
})

test('warns when the cache is stale', () => {
  const text = formatOffersBg([], '2026-09-12', '2026-09-14', { staleMinutes: 90 })
  expect(text).toContain('рецепцията')
})
```

„Няма свободно" е грешният отговор, когато истината е „минималният престой за тези дати е две нощи". Първото затваря разговора, второто продава.

- [ ] **Стъпка 2: Пусни, падат, напиши кода**

`clock.ts` експортира `makeClockProvider(supabase, config)`. Неговият `availability()` чете само от `clock_availability_cache`. Нула мрежа към Clock, докато гостът чака.

- [ ] **Стъпка 3: Комит**

```bash
git add src/lib/inventory/clock.ts src/lib/inventory/format-bg.*
git commit -m "feat: Clock inventory provider reads availability from the cache"
```

---

## Task 9: Тялото на резервацията

**Files:**
- Create: `src/lib/clock/booking-body.ts`
- Create: `src/lib/clock/booking-body.test.ts`

- [ ] **Стъпка 1: Тестовете ПЪРВО**

```ts
import { buildBookingBody } from './booking-body'

test('main_booking_guest sits outside the booking object', () => {
  const body = buildBookingBody({ /* ... */ mainBookingGuestId: '123' }) as any
  expect(body.main_booking_guest).toBe('123')
  expect(body.booking.main_booking_guest).toBeUndefined()
})

test('adults and children are separate integers', () => {
  const body = buildBookingBody({ /* adults: 2, children: 1 */ }) as any
  expect(body.booking.adults).toBe(2)
  expect(body.booking.children).toBe(1)
})

test('no room is assigned', () => {
  const body = buildBookingBody({ /* ... */ }) as any
  expect(body.booking.arrival_room_id).toBeUndefined()
})

test('the booking is marked as coming from the AI receptionist', () => {
  const body = buildBookingBody({ /* ... */ }) as any
  expect(body.booking.note).toContain('ReservAItion')
  expect(body.booking.marketing_source).toBe('Phone')
})

test('a name and a phone are enough, no email needed', () => {
  const body = buildBookingBody({ /* firstName, lastName, phone, no email, no guest id */ }) as any
  expect(body.booking.guest_first_name).toBeTruthy()
  expect(body.booking.guest_phone_number).toBeTruthy()
  expect(body.booking.guest_e_mail).toBeUndefined()
})

test('a rate id is required', () => {
  expect(() => buildBookingBody({ /* rateId: null */ })).toThrow(/rate/i)
})
```

✅ **Проверено на живо на 30.08:** резервация само с име и телефон минава (booking `38065670`), а Clock сам създава профила на госта. Агентът **не** пита за имейл.

🔴 **`rate_id` обаче е задължителен на практика.** Без него:

> `400 ... not available for the selected rate. The User doesn't have the following right: 'Booking: Rate Availability Control Override'.`

Clock проверява наличността при създаване и този потребител няма право да я заобиколи. Значи `rate_id` идва от `products` (стъпка 2 на Task 10), не се избира наум. И значи остарял кеш у нас **не може** да презапише хотела, което е добре.

- [ ] **Стъпка 2: Пусни, падат**

Run: `npm test -- src/lib/clock/booking-body.test.ts`

- [ ] **Стъпка 3: Напиши функцията**

Стаята не се разпределя. `status: 'expected'`. `reference_number` = id на разговора във Vapi.

- [ ] **Стъпка 4: Пусни, минават. Комит**

```bash
git add src/lib/clock/booking-body.*
git commit -m "feat: build the Clock booking CREATE body

main_booking_guest goes at the top level, not inside the booking object,
and a booking with neither a known guest nor an email is refused here
rather than in the middle of a phone call."
```

---

## Task 10: Доставчикът clock, писане

**Files:**
- Modify: `src/lib/inventory/clock.ts`

- [ ] **Стъпка 1: Редът на действията**

1. `clock_booking_log` по (`tenant_id`, `vapi_call_id`). Ако има ред с `clock_booking_id`, върни него. Vapi повтаря извикване, което смята за изтекло.
2. `getProducts` за истинската цена и рестрикциите.
3. `searchGuests` по телефон, после по име. Първото съвпадение дава `main_booking_guest`.
4. `buildBookingBody`, `assertWritable`, `createBooking`.
5. Запиши в `clock_booking_log`.

- [ ] **Стъпка 2: Поведение при отказ**

| Ситуация | Какво връща `spokenResult` |
|---|---|
| Няма отговор до 6 сек | „Записах заявката, рецепцията ще потвърди." Пише се ред у нас. |
| `ClockBannedError` | Същото към госта. Никакъв повторен опит. Известие: `console.error` с ясен префикс `[CLOCK BANNED]` плюс `sendOwnerNotification` към собственика на обекта. Не се строи нов канал за Спринт 1. |
| Липсва и гост, и имейл | Агентът пита за имейл и опитва пак. |

Правилото е едно: агентът **никога** не казва „готово", ако не е получил номер на резервация.

- [ ] **Стъпка 3: Комит**

```bash
git add src/lib/inventory/clock.ts
git commit -m "feat: create a real Clock booking, guest search first, idempotent per call"
```

---

## Task 11: Свързване на маршрута

**Files:**
- Modify: `src/app/api/vapi/[tenantId]/tool-call/route.ts`
- Create: `src/lib/inventory/index.ts`

- [ ] **Стъпка 1: `getInventory`**

```ts
export async function getInventory(supabase: SupabaseClient, tenantId: string): Promise<InventoryProvider> {
  const clock = await loadClockConfig(supabase, tenantId)
  return clock ? makeClockProvider(supabase, clock) : makeOwnProvider(supabase, tenantId)
}
```

- [ ] **Стъпка 2: Пренасочи двата инструмента**

`get_available_room_types` и `send_booking_inquiry` минават през доставчика. Приемат `adults`, `children`, `children_ages`.

⚠️ Днешният маршрут **гълта грешките от базата** и връща успех (това е причината бъгът от юли да живее седмици невидим). При пренасянето това се поправя: грешката се връща като честен отговор към агента.

- [ ] **Стъпка 3: Ръчна проверка, че старият път не е пипнат**

Извикай крайната точка за демо наемателя `b278d6a8-5643-4d20-b250-856a9dd6e5ce` (той няма блок `clock`) и се увери, че отговорът е същият като преди.

- [ ] **Стъпка 4: Комит**

```bash
git add src/app/api/vapi/ src/lib/inventory/index.ts
git commit -m "feat: route Vapi tools through the inventory provider"
```

---

## Task 12: Сонда срещу sandbox

**Блокира се от:** ключа на `staydesk_voice_16449`. Виж раздел 8 на спека.

**Files:**
- Create: `scripts/clock-voice-probe.mjs`

- [ ] **Стъпка 1: Само четене първо**

`rates_availability` за следващите 30 дни, `products` за конкретен период, `guests/search` по известно име от демо данните. Записва отговорите в `docs/superpowers/fixtures/`, за да станат фикстури на Task 6.

- [ ] **Стъпка 2: Един контролиран запис**

Гост с явно тестово име и бележка, че е тест. Целта е да се затвори един въпрос: минава ли `booking` CREATE без имейл, само с `guest_first_name` и `guest_phone_number`.

Три възможни изхода и какво следва от всеки:
- Минава → промптът не пита за имейл. Най-добре.
- Отказва → агентът задължително пита за имейл. Промяна само в промпта.
- Отказва и търсенето на гост не помага → искаме право `guest` CREATE от Clock. Пише се същия ден.

- [ ] **Стъпка 3: Провери в интерфейса**

Влез в sandbox-а, Operations → Arrivals, и виж резервацията. Ако не е там, тя не съществува, каквото и да е върнал API-ят.

- [ ] **Стъпка 4: Комит на сондата и фикстурите**

---

## Task 13: Демо асистент

**Files:**
- Create: `src/app/demo/clock/page.tsx`

- [ ] **Стъпка 1: Наемател**

Нов наемател „Clock демо хотел" с блок `clock` в `settings`. Ключът се слага директно в базата, не минава през код и не се пише в чат.

- [ ] **Стъпка 2: Нов Vapi асистент**

⚠️ Живият асистент `6565d0f2` (демото „Морска панорама") **не се пипа**. Той е работещото демо, което вече показваш на хотелиери.

⚠️ Живият асистент няма закачен `get_current_date`, макар че промптът разчита на него. За новия асистент го закачи от самото начало, иначе относителните дати се смятат на сляпо.

- [ ] **Стъпка 3: Страница за обаждане от браузър**

⚠️ В проекта има само `@vapi-ai/server-sdk`. Браузърният е отделен пакет и няма съществуваща страница, от която да се копира:

```bash
npm i @vapi-ai/web
```

Иска **публичния** Vapi ключ (не `VAPI_API_KEY`, който е сървърен). Слага се като `NEXT_PUBLIC_VAPI_PUBLIC_KEY`.

Един бутон, който стартира разговора с новия асистент. Показва се със споделен екран, без втори телефонен номер.

- [ ] **Стъпка 4: Репетиция**

Обади се, попитай за наличност, направи резервация, покажи я в интерфейса на Clock. Мини целия път веднъж, преди да го минеш пред Красимир.

---

## Ред на изпълнение при блокиран ключ

Задачи 0-11 не искат мрежа към Clock и се правят изцяло с тестове. Задачи 12 и 13 чакат ключа.

Ако ключът се появи по-рано, размени: направи Task 12 стъпка 2 веднага, защото отговорът ѝ променя промпта в Task 13 и фикстурите в Task 6.
