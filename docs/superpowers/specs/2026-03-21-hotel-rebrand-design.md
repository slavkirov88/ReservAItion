# ReservAItion — Хотелски AI Рецепционист: Rebrand & Restructure Design

**Date:** 2026-03-21
**Status:** Approved
**Scope:** Full rebrand from dental clinic to hotel AI receptionist — UI, navigation, database schema, and new pages.

---

## 1. Контекст

Приложението беше изградено за дентални клиники (записване на часове, пациенти, клиники). Ребрандирането го превръща в AI рецепционист за хотели — управление на резервации, стаи, типове стаи и гости.

---

## 2. Навигация (Sidebar)

| Иконка | Href | Лейбъл | Бележка |
|--------|------|--------|---------|
| LayoutDashboard | /dashboard | Dashboard | Остава |
| Sun | /today | Днес | Нова страница |
| CalendarDays | /reservations | Резервации | Замества /appointments |
| BedDouble | /rooms | Стаи | Нова страница |
| Settings | /settings/profile | Настройки | Остава |
| CreditCard | /subscription | Абонамент | Остава |

Премахват се: `/calendar`, `/appointments` (пренасочват към новите routes).

---

## 3. База данни — Миграции

### 3.1 Преименуване на таблица
```sql
ALTER TABLE appointments RENAME TO reservations;
```

### 3.2 Преименуване на полета в `reservations`
```sql
ALTER TABLE reservations RENAME COLUMN patient_name TO guest_name;
ALTER TABLE reservations RENAME COLUMN patient_phone TO guest_phone;
ALTER TABLE reservations RENAME COLUMN starts_at TO check_in_date;
ALTER TABLE reservations ADD COLUMN check_out_date timestamptz;
ALTER TABLE reservations ADD COLUMN room_type_id uuid REFERENCES room_types(id);
ALTER TABLE reservations ADD COLUMN room_id uuid REFERENCES rooms(id);
```

Полето `service` се запазва временно като `room_type_name` за backwards compat, после се премахва.

### 3.3 Нова таблица `room_types`
```sql
CREATE TABLE room_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name text NOT NULL,                  -- напр. "Стандартна", "Делукс"
  description text,
  capacity int NOT NULL DEFAULT 2,
  price_per_night numeric(10,2) NOT NULL,
  created_at timestamptz DEFAULT now()
);
```

### 3.4 Нова таблица `rooms`
```sql
CREATE TABLE rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  room_type_id uuid NOT NULL REFERENCES room_types(id) ON DELETE CASCADE,
  room_number text,                    -- nullable — не всички хотели ги номерират
  name text,                           -- напр. "Морска стая" (по избор)
  status text NOT NULL DEFAULT 'free'  -- free | occupied | cleaning | maintenance
    CHECK (status IN ('free', 'occupied', 'cleaning', 'maintenance')),
  created_at timestamptz DEFAULT now()
);
```

**Логика на двата варианта:**
- Хотел с номера: добавя стаи с `room_number` (101, 102...) и `room_type_id`
- Хотел с типове: добавя само `room_types`, стаи по избор

**Резервация:**
- `room_type_id` — задължително при резервиране (какъв тип е поискан)
- `room_id` — nullable, задава се при настаняване (check-in)

---

## 4. Нови TypeScript типове

```typescript
interface RoomType {
  id: string
  tenant_id: string
  name: string
  description: string | null
  capacity: number
  price_per_night: number
  created_at: string
}

interface Room {
  id: string
  tenant_id: string
  room_type_id: string
  room_number: string | null
  name: string | null
  status: 'free' | 'occupied' | 'cleaning' | 'maintenance'
  created_at: string
}

interface Reservation {
  id: string
  tenant_id: string
  guest_name: string
  guest_phone: string
  room_type_id: string | null
  room_id: string | null
  check_in_date: string
  check_out_date: string | null
  status: 'confirmed' | 'cancelled' | 'completed' | 'no_show'
  channel: 'phone' | 'chat' | 'manual'
  notes: string | null
  created_at: string
}
```

---

## 5. Dashboard — Нови KPI карти

Заменят "часове" статистиките:

| Карта | Метрика | Икона |
|-------|---------|-------|
| Заетост % | заети стаи / всички стаи × 100 | BedDouble |
| Check-ins днес | резервации с check_in_date = днес | LogIn |
| Check-outs днес | резервации с check_out_date = днес | LogOut |
| AI обаждания | conversations тази седмица (channel=phone) | Phone |

Графиката "Часове по час на деня" → "Резервации по ден от седмицата".

---

## 6. Страница "Днес" (`/today`)

Два раздела:

**Пристигащи (Check-ins):**
- Таблица: гост, тип стая, стая (ако е назначена), час на пристигане
- Бутон "Настани" → отваря modal за назначаване на конкретна стая

**Напускащи (Check-outs):**
- Таблица: гост, стая, час на напускане
- Бутон "Освободи стая" → сменя статуса на стаята на `cleaning`

---

## 7. Страница "Стаи" (`/rooms`)

Два таба:

**Типове стаи:**
- Карти за всеки тип: име, цена/нощ, капацитет, описание
- Бутон "Добави тип"
- Edit/Delete на всеки тип

**Стаи:**
- Таблица: номер/ime, тип, статус (с цветен badge)
- Статус може да се сменя ръчно (free / cleaning / maintenance)
- Бутон "Добави стая"
- Ако хотелът не използва конкретни стаи — табът е скрит или показва prompt за добавяне

---

## 8. Страница "Резервации" (`/reservations`)

Замества `/appointments`:
- Таблица с гост, тип стая, стая, check-in, check-out, статус
- Филтри по статус и дата
- Бутон "Нова резервация" (ръчно добавяне)

---

## 9. Настройки — Текстови промени

| Файл | Старо | Ново |
|------|-------|------|
| settings/profile | "Профил на клиниката" | "Профил на хотела" |
| settings/profile | "Основна информация за вашата клиника" | "Основна информация за вашия хотел" |
| settings/schedule | "работния график на вашата клиника" | "работното време на вашия хотел" |
| settings/services | Services page | Заменя се от Стаи страницата |
| onboarding Step1 | placeholder "Дентален Център Иванов" | "Хотел Морски Бриз" |

---

## 10. AI Промпт — Промени

`src/lib/ai/prompt-generator.ts` и `src/app/api/vapi/[tenantId]/tool-call/route.ts`:

- "клиниката е затворена" → "хотелът не приема резервации"
- "Свободни часове" → "Свободни стаи"
- "Записвай часове: питай за услуга → дата → час" → "Записвай резервации: питай за тип стая → дати на настаняване и напускане → брой гости → ime и телефон"
- "Часът е записан успешно" → "Резервацията е потвърдена успешно"

---

## 11. Onboarding — Промени

- Step 1: placeholder от дентален към хотелски
- Step 2 ("Услуги"): заменя се с "Типове стаи" — потребителят добавя room types по време на onboarding
- Step 5: "ReservAItion е активен" — остава

---

## 12. Засегнати файлове

### DB миграция (Supabase)
- Нова SQL миграция файл

### TypeScript типове
- `src/types/database.ts`

### API routes
- `src/app/api/vapi/[tenantId]/tool-call/route.ts`
- `src/app/api/chat/[apiKey]/route.ts`
- `src/app/api/onboarding/complete/route.ts`

### Компоненти
- `src/components/layout/AppSidebar.tsx`
- `src/components/analytics/StatsCards.tsx`
- `src/components/analytics/CallsByHourChart.tsx`
- `src/components/appointments/AppointmentTable.tsx` → ReservationTable
- `src/components/settings/ProfileEditor.tsx`
- `src/components/onboarding/steps/Step1BusinessProfile.tsx`
- `src/components/onboarding/steps/Step2Services.tsx` → Step2RoomTypes

### Нови компоненти/страници
- `src/app/(dashboard)/today/page.tsx`
- `src/app/(dashboard)/rooms/page.tsx`
- `src/app/(dashboard)/reservations/page.tsx`
- `src/components/rooms/RoomTypesTab.tsx`
- `src/components/rooms/RoomsTab.tsx`
- `src/components/reservations/ReservationTable.tsx`

### Пренасочвания (redirects)
- `/appointments` → `/reservations`
- `/calendar` → `/today`
