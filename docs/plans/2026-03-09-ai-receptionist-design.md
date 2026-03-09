# ReceptAI — AI Рецепционист за Здравни Заведения
**Дата:** 2026-03-09
**Статус:** Одобрен дизайн

---

## Контекст

SaaS продукт — AI рецепционист за зъболекарски кабинети, частни клиники и здравни заведения в България. Агентът отговаря на телефон (Vapi) и chat widget, записва часове и отговаря на стандартни въпроси.

---

## Решения

| Компонент | Решение |
|-----------|---------|
| Framework | Next.js 16.1.1 + React 19 + TypeScript 5 |
| Database | Supabase PostgreSQL + RLS |
| Auth | Supabase Auth (Email + OAuth) |
| Voice | Vapi (BG + EN) |
| Chat | Custom embeddable JS widget + SSE |
| AI модел | GPT-4o-mini |
| Плащания | Stripe |
| Rate limiting | Upstash Redis |
| Styling | TailwindCSS 4 + shadcn/ui |
| Deploy | Vercel |

---

## Архитектура

Монолитен Next.js SaaS с multi-tenant модел. Всеки бизнес = един tenant с уникален `tenant_id`. RLS в Supabase гарантира изолация на данните.

```
┌─────────────────────────────────────────────────────┐
│                   DASHBOARD (Next.js)                │
│  Onboarding │ Календар │ AI Config │ Analytics       │
└─────────────────────────────────────────────────────┘
         │                        │
         ▼                        ▼
┌─────────────────┐    ┌──────────────────────┐
│   VAPI (Phone)  │    │   CHAT WIDGET        │
│  BG + EN voice  │    │  Embeddable JS       │
│  Webhook → API  │    │  за сайта на клиента │
└────────┬────────┘    └──────────┬───────────┘
         │                        │
         ▼                        ▼
┌─────────────────────────────────────────────────────┐
│              AI ENGINE (API Routes)                  │
│   Booking логика │ FAQ отговори │ Slot validation    │
└─────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────┐
│              SUPABASE (PostgreSQL + RLS)             │
│   tenants │ schedules │ appointments │ conversations  │
└─────────────────────────────────────────────────────┘
```

---

## Database Schema

```sql
tenants
  id                UUID PK
  owner_id          UUID → auth.users
  business_name     TEXT
  slug              TEXT UNIQUE
  phone             TEXT
  address           TEXT
  language          TEXT[]             -- ['bg', 'en']
  public_api_key    UUID UNIQUE
  subscription_status TEXT            -- 'trial' | 'active' | 'cancelled'
  created_at        TIMESTAMPTZ

business_profiles
  id                UUID PK
  tenant_id         UUID → tenants
  services          JSONB              -- [{name, duration_min, price}]
  faqs              JSONB              -- [{question, answer}]
  booking_rules     TEXT
  welcome_message   TEXT

schedule_rules
  id                UUID PK
  tenant_id         UUID → tenants
  day_of_week       INT                -- 0=Нед, 1=Пон...
  start_time        TIME
  end_time          TIME
  slot_duration_min INT
  is_active         BOOLEAN

schedule_overrides
  id                UUID PK
  tenant_id         UUID → tenants
  date              DATE
  override_type     TEXT               -- 'closed' | 'custom'
  slots             JSONB
  note              TEXT

appointments
  id                UUID PK
  tenant_id         UUID → tenants
  patient_name      TEXT
  patient_phone     TEXT
  service           TEXT
  starts_at         TIMESTAMPTZ
  ends_at           TIMESTAMPTZ
  status            TEXT               -- 'confirmed' | 'cancelled' | 'no_show'
  channel           TEXT               -- 'phone' | 'chat'
  created_at        TIMESTAMPTZ

conversations
  id                UUID PK
  tenant_id         UUID → tenants
  channel           TEXT               -- 'phone' | 'chat'
  language          TEXT               -- 'bg' | 'en'
  transcript        JSONB              -- [{role, content, timestamp}]
  appointment_id    UUID → appointments (nullable)
  duration_sec      INT
  created_at        TIMESTAMPTZ
```

---

## AI Engine

### Vapi Integration

- Всеки tenant получава уникален Vapi phone number
- Vapi assistant се конфигурира динамично при onboarding
- Webhook: `POST /api/vapi/[tenant_id]/tool-call`

**Vapi Tools:**
- `get_available_slots` — чете свободни часове от DB
- `book_appointment` — записва час в DB
- `get_business_info` — връща FAQ, адрес, работно време

### System Prompt (динамичен per tenant)

```
Ти си AI рецепционист на {business_name}.
Адрес: {address}. Работно време: {hours}.
Услуги: {services_with_prices}.

Задачи:
1. Отговаряй на въпроси за работното време, адреса и услугите
2. Записвай часове — питай за: услуга → дата → час → ime → телефон
3. Говори на езика на пациента (БГ или EN)
4. При неясна ситуация — предложи да се обади в работно време

НЕ измисляй информация. НЕ давай медицински съвети.
{custom_booking_rules}
```

### Chat Widget

```html
<script src="https://receptai.bg/widget.js"
        data-key="PUBLIC_API_KEY"></script>
```

Комуникира с `/api/chat/[public_api_key]` чрез SSE (Server-Sent Events) за streaming отговори.

### Slot логика

1. Вземи `schedule_rules` за деня
2. Провери `schedule_overrides` (затворено?)
3. Вземи всички `appointments` за деня
4. Изчисли свободните слотове
5. Върни топ 3 опции
6. При потвърждение → INSERT с optimistic locking

---

## Dashboard UI

### Onboarding Wizard (5 стъпки)

1. **Бизнес профил** — име, адрес, телефон, описание
2. **Услуги** — таблица с услуга / продължителност / цена
3. **Работно време** — правила + почивки
4. **FAQ** — до 10 въпроса/отговора
5. **Готово** — телефонен номер + embed код

### Sidebar навигация

```
├── Dashboard (analytics)
├── Календар
├── Записи
├── Настройки
│   ├── Профил
│   ├── Услуги
│   ├── Работно време
│   └── AI Конфигурация
└── Абонамент
```

### Analytics метрики

- Обаждания тази седмица
- Записани часове
- Средна продължителност на разговор
- Успеваемост на AI (%)
- График: обаждания по час на деня
- Таблица: последни разговори с транскрипт

---

## Security

- **RLS** на всяка таблица → `tenant_id = auth.uid()`
- **Chat widget** → `public_api_key` с ограничен достъп (само slots read + appointments write)
- **Vapi webhooks** → HMAC signature validation
- **Rate limiting** → Upstash Redis per tenant
- **GDPR** → право на изтриване, data export, без PII в logs
- **Encryption** → Supabase encryption at rest, phone/имена криптирани

---

## Pricing

| План | Цена | Включва |
|------|------|---------|
| Стартов | 149 лв/месец | До 200 обаждания, chat widget, неограничени записи, 1 потребител |
| Pro | 299 лв/месец | Неограничени обаждания, SMS напомняния, 3 потребители, приоритетна поддръжка |

14-дневен безплатен trial без карта.

---

## Scaling пътека

| Клиенти | Infrastructure |
|---------|----------------|
| 0-50 | Vercel hobby/pro + Supabase free/pro |
| 50-200 | Vercel pro + Supabase pro + Upstash Redis |
| 200-500 | Dedicated Supabase + edge caching |
| 500+ | Kubernetes / собствен infrastructure |

---

## Go-to-Market

- **Месец 1-2:** 5 безплатни пилотни клиники → feedback → case studies
- **Месец 3-4:** Facebook/Instagram ads, LinkedIn, дентални асоциации
- **Месец 5+:** Referral програма, съдържание, разширяване към козметични клиники

---

## MVP Scope (умишлено изключено за v1)

- SMS напомняния (v2)
- Google Calendar интеграция (v2)
- Мобилно приложение (v3)
- Онлайн плащания (v3)
- Повече от 2 езика (v3)
