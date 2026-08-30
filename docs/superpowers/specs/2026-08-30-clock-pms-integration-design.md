# Интеграция с Clock PMS+ - Спринт 1 (демо срещу sandbox)

**Дата:** 2026-08-30
**Статус:** Одобрен дизайн
**Цел на спринта:** обаждане от браузър към нов Vapi асистент, който казва реална наличност от Clock и създава резервация, видима в техния интерфейс. Показва се на Красимир Трапчев (Clock Software) следващата седмица.

---

## 1. Контекст

Днес ReservAItion **притежава** инвентара: `room_types`, `rooms`, `seasonal_pricing` и `reservations` живеят в нашата Supabase. `getAvailableRoomTypes` чете оттам, `send_booking_inquiry` пише там.

При хотел на Clock PMS+ инвентарът принадлежи на PMS-а. Хотелът няма да го изостави. Значи за такъв наемател двете операции трябва да сочат навън, без да се разваля днешният модел за малките обекти.

Sandbox: `sky-eu1`, абонамент 176987, хотел 16449, API потребител `staydesk_voice_16449`.

### Права на `staydesk_voice` (от имейла им, 25.08.2026)

`room_types` VIEW · `rates` VIEW LIST · `rates_availability` VIEW (макс 365 дни) · `products` VIEW · `guests` **search** · `booking` **CREATE**

⚠️ `guest` CREATE **не фигурира** в списъка. Виж раздел 8.

---

## 2. Архитектура: доставчик на инвентар

Ново директорийче `src/lib/inventory/`:

| Файл | Отговорност |
|---|---|
| `types.ts` | `RoomOffer`, `BookingRequest`, `BookingResult`, `InventoryProvider` |
| `own.ts` | обвива днешните `getAvailableRoomTypes` и записа в `reservations` |
| `clock.ts` | чете от кеша, пише в Clock |
| `index.ts` | `getInventory(supabase, tenant)` избира по `tenants.settings->clock` |

```ts
interface InventoryProvider {
  availability(checkIn: string, checkOut: string, guests: GuestCount): Promise<RoomOffer[]>
  createBooking(req: BookingRequest): Promise<BookingResult>
}
```

Маршрутът `/api/vapi/[tenantId]/tool-call` не знае кой доставчик стои отзад. Наемател без блок `clock` в настройките получава `own` и се държи точно както днес. Това е и тестът дали границата е правилна: съществуващите наематели не забелязват нищо.

`GuestCount` е `{ adults, children, childrenAges }`. Виж раздел 7.

---

## 3. Clock клиент

Пренася се от StayDesk `lib/clock/client.ts` без промени по същността. Той вече носи:

- Digest автентикация на ръка (двустъпково ръкостискане, fetch не го говори)
- Собствен ограничител **5 заявки/сек** на API потребител
- Повторен опит **само** при `429` и мрежов срив. Тяхното изискване дословно: „Other client errors (4xx, 5xx) ... Please do not retry them automatically."
- Изчакване по тяхната формула: брояч × 500 мс
- `ClockBannedError` при `403` - WAF-ът бани IP за два часа, повтарянето удължава бана
- Твърд краен срок за всяко извикване, защото по т.6.2 от условията им скоростта не е гарантирана

Добавя се само това, което voice потребителят ползва: `getRatesAvailability`, `getProducts`, `searchGuests`, `createBooking`.

**Двата API потребителя се държат разделени.** Ограничителят брои на потребител, за да не си харчат квотата взаимно.

---

## 4. Конфигурация на наемателя

Миграция: `ALTER TABLE tenants ADD COLUMN settings jsonb NOT NULL DEFAULT '{}'`.

```json
{
  "clock": {
    "base_url": "https://sky-eu1.clock-software.com/pms_api/176987/16449",
    "api_user": "staydesk_voice_16449",
    "api_key": "…",
    "rate_ids": [123, 456],
    "sandbox": true
  }
}
```

Кредитивите живеят на реда на наемателя, не в environment. Този урок е платен в StayDesk, където глобален `TELEGRAM_MANAGER_CHAT_ID` пращаше заявките на един хотел в групата на друг.

Флагът `sandbox: true` е предпазител: докато е вдигнат, `createBooking` отказва да пише към адрес, който не е sandbox.

---

## 5. Кеш на наличността

Таблица `clock_availability_cache`:

| Колона | Тип |
|---|---|
| `tenant_id` | uuid |
| `clock_room_type_id` | integer |
| `room_type_name` | text |
| `clock_rate_id` | integer |
| `date` | date |
| `free` | boolean |
| `price_cents` | integer |
| `currency` | text |
| `free_rooms` | integer |
| `min_stay` | integer |
| `closed_for_arrival` | boolean |
| `stop_from_sale` | boolean |
| `fetched_at` | timestamptz |

Първичен ключ: (`tenant_id`, `clock_room_type_id`, `clock_rate_id`, `date`).

Cron `/api/cron/clock-availability` на всеки 15 минути тегли `rates_availability` за **90 дни напред** и прави upsert.

Защо не 365, при положение че разрешават: това е най-тежката им заявка, тяхната собствена препоръка е кеширане на 15-20 минути, а гласов агент не приема резервация година напред по телефона. 90 дни покриват сезона.

**Наличността по време на разговор се чете само от кеша.** Нула мрежа към Clock, докато гостът чака. Това урежда т.6.2 от условията им: тяхната латентност не може да провали разговор.

---

## 6. Пътят на разговора

### `get_available_room_types(check_in, check_out, adults, children)`

Чете кеша, връща типовете с цена и брой свободни. Отговор под 300 мс.

### `create_booking(...)`

1. **`products`** с точните дати, тарифи и брой гости. Това е единственото извикване към Clock по време на разговора и връща истинската цена и рестрикциите. Ако не минава (например `min_stay` 2 нощи), агентът казва **защо**, вместо „няма свободно".
2. **`guests/search?free_text_search=<телефон>`**, после по име. Ако профилът съществува, id-то му отива в `main_booking_guest`. Без тази стъпка всеки повторен гост става дубликат в базата на хотела, а хотелиер го забелязва веднага.
3. **`booking` CREATE**:

```json
{
  "booking": {
    "arrival": "2026-09-12",
    "departure": "2026-09-14",
    "status": "expected",
    "arrival_room_type_id": 42414,
    "adults": 2,
    "children": 1,
    "rate_id": 123,
    "reference_number": "<vapi call id>",
    "marketing_source": "Phone",
    "note": "Създадена от AI рецепциониста (ReservAItion)",
    "guest_first_name": "…",
    "guest_last_name": "…",
    "guest_phone_number": "…"
  },
  "main_booking_guest": "<id ако е намерен>"
}
```

**`main_booking_guest` се подава извън обекта `booking`.** Вътре не работи.

`arrival_room_id` **не** се подава. Стаята разпределя рецепцията - това е тяхната работа и тяхната отговорност.

---

## 7. Защо `adults` и `children` вече не са по избор

Два независими факта от документацията им:

1. `booking` има нативни полета `adults` и `children`.
2. `rates_availability` и `products` приемат `adults`, `children`, `children_ages`, и **без тях цената при тарифи „на човек" се смята грешно**.

Клонът `feature/guest-breakdown` (написан 08.06.2026, никога не пуснат) прави точно това разделяне. Влива се в тази работа, а не се отлага. Миграцията в него е `010_guest_breakdown.sql`.

---

## 8. 🔴 Отворен въпрос: гост без имейл

`booking` CREATE изисква `guest_e_mail` **или** `main_booking_guest`. По телефона гостът рядко диктува имейл, а `staydesk_voice` няма изрично право `guest` CREATE.

Три възможни изхода:

1. Агентът задължително пита за имейл преди запис.
2. Полетата `guest_first_name` / `guest_phone_number` в самата резервация стигат. Документацията **не** го обещава.
3. Искаме допълнително право за `guest` CREATE. Те позволяват заявки, при посочване за кой потребител и как ще се ползва.

**Проверява се с един контролиран опит в sandbox-а, преди да се пише кодът.** Ако отговорът е (1), промптът се променя и това е. Ако е (3), пишем на Красимир още тази седмица, защото право не се дава за ден.

Дотогава `createBooking` се пише така, че пътят с намерен гост и пътят с имейл са два отделни, тествани клона.

---

## 9. Поведение при отказ

Правилото е едно: **никога не лъжем госта.**

| Ситуация | Поведение |
|---|---|
| Clock не отговори до 6 сек при създаване | Агентът казва „записах заявката, рецепцията ще потвърди". Пише се ред у нас като резерва. НЕ казва „готово". |
| `403` от WAF | Спира всичко за този наемател, известие. Повтарянето удължава бана. |
| `429` | Ограничителят не трябва да го допуска. Ако се случи, изчакване брояч × 500 мс. |
| Кешът е по-стар от 60 минути | Агентът дава наличността, но добавя, че рецепцията потвърждава. Демото не спира заради спрял cron. |
| `products` върне рестрикция | Казва причината: „за тези дати минималният престой е 2 нощи". |

**Идемпотентност:** `reference_number` = id на разговора във Vapi. Пази се и локална таблица `clock_booking_log` (наемател, call id, clock booking id), за да не създадем две резервации, ако Vapi повтори извикването.

---

## 10. Тестове

**Единични (без мрежа):**
- картографиране на ред от кеша към `RoomOffer`
- избор на рестрикция и текста на български
- сглобяване на тялото на `booking` CREATE, включително че `main_booking_guest` е на горно ниво
- `own.ts` дава същото, което дава днешният код (регресия)

**Срещу sandbox (ръчно, извиква се със скрипт):**
- `rates_availability` за известен период връща очакваните типове
- търсене на гост по телефон намира съществуващ профил
- създаване на резервация → излиза в `bookings` LIST и в Arrivals

---

## 11. Извън обхвата на Спринт 1

Уебхукове, онбординг екран за хотела, депозити и Stripe, смяна на стая, писане в нашето табло за Clock наематели, iCal за Clock наематели.

### Бележка за Спринт 2 (уебхукове)

`POST /base_api/{sub}/{acc}/webhook_subscription`, тяло само `{"endpoint": "..."}`.

🔴 Дословно от документацията им: „you can't delete it within the next 48 hours". Един уебхук на API потребител. Значи крайната точка трябва да е пусната, стабилна и с неотгатваем таен токен в адреса **преди** регистрацията. Първо се доставя `SubscriptionConfirmation` със `SubscribeURL`; докато не се посети, не идва нито едно събитие и няма грешка, само тишина.

---

## 12. Източници

- Clock PMS+ API Docs (Postman): https://api-docs.clock-software.com/
- `booking` CREATE, `guests/search`, `rates_availability`, `products`, `webhook_subscription` - извлечени от публикуваната колекция, 2026-08-30
- `Clients/Clock-Software-Partnership/SANDBOX-находки-и-план.md` - правата на двата потребителя, рейт лимитът, WAF-ът, SNS капаните
- StayDesk `lib/clock/` - работещият клиент, от който се пренася
