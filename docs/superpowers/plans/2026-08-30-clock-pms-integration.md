# Clock PMS+ интеграция - план за изпълнение (Спринт 1)

> **За агентни работници:** ЗАДЪЛЖИТЕЛНО ПОД-УМЕНИЕ: използвай superpowers:subagent-driven-development (препоръчано) или superpowers:executing-plans, за да изпълниш този план задача по задача. Стъпките са с чекбокс (`- [ ]`) за проследяване.

**Goal:** Гласовият агент чете реална наличност от Clock PMS+ през локален кеш и създава истинска резервация в PMS-а, видима в техния интерфейс.

**Architecture:** Нов слой `src/lib/inventory/` с два доставчика зад един интерфейс. `own` обвива днешния код и не променя поведението за съществуващите наематели. `clock` чете от таблица-кеш, пълнена от cron на 15 минути, и пише през REST клиента, пренесен от StayDesk. Маршрутът на Vapi инструментите не знае кой доставчик стои отзад.

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
| `src/app/api/cron/clock-availability/route.ts` | Пълни кеша на 15 минути. |
| `src/app/api/vapi/[tenantId]/tool-call/route.ts` | Модифициран: минава през `getInventory`. |
| `supabase/migrations/011_clock_integration.sql` | `tenants.settings`, кеш таблица, лог на резервациите. |
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

- [ ] **Стъпка 3: Комит**

```bash
git add supabase/migrations/011_clock_integration.sql
git commit -m "feat: schema for Clock tenant config, availability cache and booking log"
```

---

## Task 2: Пренасяне на Clock клиента

Източник: `C:/Users/mariy/Desktop/AIOS/StayDesk/lib/clock/client.ts` и `client` частта от неговите тестове. Пренася се транспортът, не бизнес логиката за престои.

**Files:**
- Create: `src/lib/clock/client.ts`
- Create: `src/lib/clock/client.test.ts`

- [ ] **Стъпка 1: Копирай транспортната част**

Взимат се: `ClockCredentials`, `ClockRequestOptions`, `ClockError`, `ClockBannedError`, `RATE_LIMIT_PER_SECOND`, `waitForSlot`, `resetRateLimiter`, `parseDigestChallenge`, `buildDigestHeader`, `clockGet`.

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
    method: 'GET', uri: '/pms_api/1/2/rooms/', user: 'u', key: 'k',
    challenge: { realm: 'clock', nonce: 'abc', qop: 'auth' },
  })
  expect(header).toContain('username="u"')
  expect(header).toContain('uri="/pms_api/1/2/rooms/"')
  expect(header).toContain('response=')
})
```

Точните аргументи на `buildDigestHeader` се четат от пренесения файл и тестът се напасва по тях, не обратното.

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

⚠️ Параметрите на `products` са с квадратни скоби в името (`product_search[arrival]`). Кодирай ги, не ги „оправяй".

⚠️ `adults`, `children` и `children_ages` се подават и на `rates_availability`, и на `products`. Без тях цената при тарифи „на човек" се смята грешно. Това е записано в тяхната документация, не е предположение.

- [ ] **Стъпка 2: Комит**

```bash
git add src/lib/clock/voice.ts
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
  pricePerNight: number      // в евро, не в стотинки
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
  expect(offers[0]).toEqual({ id: 'uuid-1', name: 'Студио', pricePerNight: 88, availableRooms: 2, capacity: 2 })
})
```

- [ ] **Стъпка 3: Пусни го, увери се, че пада**

Run: `npm test -- src/lib/inventory/own.test.ts`
Expected: FAIL, `toOffers` не съществува.

- [ ] **Стъпка 4: Напиши `own.ts`**

Обвива `getAvailableRoomTypes` от `src/lib/availability.ts` и записа в `reservations`, който днес живее в маршрута. Нищо не се преизчислява наново.

- [ ] **Стъпка 5: Пусни тестовете**

Run: `npm test -- src/lib/inventory`
Expected: PASS

- [ ] **Стъпка 6: Комит**

```bash
git add src/lib/inventory/
git commit -m "feat: inventory provider interface and the own-inventory implementation"
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

Истинската форма на отговора се взима от Task 12 (сондата) и се залепя тук като фикстура. Докато нямаме ключ, фикстурата се пише по описанието в документацията и се сверява веднага щом ключът се появи.

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
- Modify: `vercel.json`

- [ ] **Стъпка 1: Напиши маршрута**

За всеки наемател с блок `clock`: `getRatesAvailability` от днес до днес + 90 дни, `toCacheRows`, upsert.

Пази `x-cron-secret`, както прави съществуващият cron в проекта. Провери как точно е направено там и следвай същия начин, не измисляй втори.

- [ ] **Стъпка 2: Регистрирай го**

⚠️ Vercel Hobby планът дава **един cron на ден**, не на 15 минути. Това е записано в историята на този проект (комит `f24b809 fix: cron schedule once daily for Hobby plan`).

За демото това е достатъчно: кешът се пълни ръчно с извикване на маршрута преди да покажеш. За пилотен хотел се решава отделно, извън този спринт.

- [ ] **Стъпка 3: Комит**

```bash
git add src/app/api/cron/clock-availability/route.ts vercel.json
git commit -m "feat: cron endpoint that refills the Clock availability cache"
```

---

## Task 8: Доставчикът clock, четене

**Files:**
- Create: `src/lib/inventory/clock.ts`
- Create: `src/lib/inventory/format-bg.ts`
- Create: `src/lib/inventory/format-bg.test.ts`

- [ ] **Стъпка 1: Тестове за българския текст**

```ts
test('says the reason when a restriction blocks the dates', () => {
  const text = formatOffersBg([{ id: '1', name: 'Двойна', pricePerNight: 120, availableRooms: 0, restriction: 'min_stay:2' }], '2026-09-12', '2026-09-13')
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

`clock.availability()` чете само от `clock_availability_cache`. Нула мрежа към Clock, докато гостът чака.

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

test('without a known guest and without an email it refuses to build', () => {
  expect(() => buildBookingBody({ /* mainBookingGuestId: null, email: null */ })).toThrow()
})
```

Последният тест кодира тяхното правило: задължително е `guest_e_mail` **или** `main_booking_guest`. По-добре да гръмне у нас с ясно съобщение, отколкото Clock да върне грешка насред разговор.

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
| `ClockBannedError` | Същото към госта. Известие към нас. Никакъв повторен опит. |
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

Vapi web SDK, един бутон. Показва се със споделен екран, без втори телефонен номер.

- [ ] **Стъпка 4: Репетиция**

Обади се, попитай за наличност, направи резервация, покажи я в интерфейса на Clock. Мини целия път веднъж, преди да го минеш пред Красимир.

---

## Ред на изпълнение при блокиран ключ

Задачи 0-11 не искат мрежа към Clock и се правят изцяло с тестове. Задачи 12 и 13 чакат ключа.

Ако ключът се появи по-рано, размени: направи Task 12 стъпка 2 веднага, защото отговорът ѝ променя промпта в Task 13 и фикстурите в Task 6.
