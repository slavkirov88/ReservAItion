# HotelAI — 24/7 AI Hotel Receptionist
**Date:** 2026-03-18
**Status:** Approved design

---

## Context

Extend the existing ReceptAI SaaS platform (currently serving healthcare tenants) to support hotels, guesthouses, and property managers as a second vertical. The AI agent handles inbound calls and chat 24/7, checks room availability, collects guest details, sends a proforma invoice with a 48-hour payment window, and confirms or cancels the reservation automatically.

The platform operator (us) starts with white-glove manual setup (phase 1) to collect early revenue, then builds toward full self-serve onboarding (phase 2).

---

## Tech Stack (unchanged from existing)

| Component | Solution |
|-----------|----------|
| Framework | Next.js + React + TypeScript |
| Database | Supabase PostgreSQL + RLS |
| Auth | Supabase Auth |
| Voice | Vapi (multilingual) |
| Chat | Custom embeddable JS widget + SSE |
| AI model | GPT-4o-mini |
| Payments | Stripe (subscriptions + payment links) |
| Invoices | @react-pdf/renderer + Resend email |
| CRM | Notion MCP |
| iCal sync | Supabase Edge Function cron |
| Styling | TailwindCSS + shadcn/ui |
| Deploy | Vercel |

---

## Architectural Approach

**Vertical fork within the same codebase.** A `business_type` field on the `tenants` table (`'clinic' | 'hotel'`) gates all hotel-specific UI and logic. Shared infrastructure (Vapi integration, chat widget, Stripe billing, Supabase multi-tenant RLS, auth, Notion MCP) is reused unchanged. Hotel-specific logic lives in new, isolated modules.

---

## Database Schema (new tables)

```sql
-- Extend existing tenants table
ALTER TABLE tenants ADD COLUMN business_type TEXT DEFAULT 'clinic';
-- 'clinic' | 'hotel'

rooms
  id              UUID PK
  tenant_id       UUID → tenants
  name            TEXT          -- "Sea View Double", "Standard Single"
  type            TEXT          -- 'single' | 'double' | 'suite' | 'apartment'
  capacity        INT           -- max guests
  base_price      DECIMAL       -- price per night
  amenities       JSONB         -- ["wifi", "ac", "balcony"]
  ical_url        TEXT          -- Booking.com / Airbnb iCal import feed
  ical_export_url TEXT          -- our generated iCal for export to OTAs
  created_at      TIMESTAMPTZ

room_reservations
  id              UUID PK
  tenant_id       UUID → tenants
  room_id         UUID → rooms
  guest_name      TEXT
  guest_email     TEXT
  guest_phone     TEXT
  check_in        DATE
  check_out       DATE
  nights          INT
  total_price     DECIMAL
  status          TEXT          -- 'on_hold' | 'confirmed' | 'cancelled'
  invoice_id      UUID → invoices
  held_until      TIMESTAMPTZ   -- created_at + 48h
  source          TEXT          -- 'voice' | 'chat' | 'manual'
  created_at      TIMESTAMPTZ

invoices
  id              UUID PK
  tenant_id       UUID → tenants
  reservation_id  UUID → room_reservations
  guest_email     TEXT
  guest_phone     TEXT
  amount          DECIMAL
  currency        TEXT
  pdf_url         TEXT
  stripe_payment_link TEXT
  status          TEXT          -- 'sent' | 'paid' | 'expired'
  sent_at         TIMESTAMPTZ
  expires_at      TIMESTAMPTZ   -- sent_at + 48h
  paid_at         TIMESTAMPTZ

ical_blocks
  id          UUID PK
  room_id     UUID → rooms
  source      TEXT              -- 'booking.com' | 'airbnb' | 'manual'
  start_date  DATE
  end_date    DATE
  summary     TEXT              -- raw event title from iCal
  synced_at   TIMESTAMPTZ
```

---

## AI Agent & Booking Flow

### Conversation flow

```
Guest calls / opens chat
       │
       ▼
Agent greets in hotel's configured language(s)
       │
       ▼
Collects: check-in, check-out, number of guests, room preference
       │
       ▼
check_room_availability(check_in, check_out, guests)
  → queries rooms + room_reservations (on_hold/confirmed) + ical_blocks
  → returns available rooms with prices
       │
       ▼
Agent presents options, confirms price with guest
       │
       ▼
Collects: guest name, email, phone
       │
       ▼
create_reservation(room_id, guest_details, dates)
  → creates room_reservations (status='on_hold', held_until=now+48h)
  → generates PDF invoice
  → creates Stripe payment link
  → sends invoice email via Resend
  → updates iCal export
  → creates Notion page in hotel's guest CRM
       │
       ▼
Agent confirms: "Invoice sent to [email]. Pay within 48 hours to secure your booking."
       │
    ┌──┴──────────────┐
  paid (Stripe webhook)   not paid (cron after 48h)
    │                          │
  status → confirmed        status → cancelled
  Notion updated            Notion updated
  iCal confirmed            iCal dates released
  confirmation email        cancellation email to guest
```

### Vapi tools (hotel vertical)

| Tool | Description |
|------|-------------|
| `check_room_availability` | Query live DB + iCal blocks for available rooms |
| `create_reservation` | Create on_hold reservation, generate invoice, send email |
| `get_hotel_info` | FAQs, amenities, policies, check-in/out times, location |
| `cancel_reservation` | Cancel by reference number, release dates |

---

## iCal Sync

### Import (blocking external dates)
- Hotel pastes Booking.com / Airbnb iCal feed URL per room during setup
- Supabase Edge Function cron runs every 30 minutes, fetches each `ical_url`, parses events, upserts into `ical_blocks`
- `check_room_availability` combines `room_reservations` + `ical_blocks` to determine true availability

### Export (blocking our dates on OTAs)
- Public endpoint: `GET /api/public/ical/[roomId]`
- Returns iCal feed of all `confirmed` + `on_hold` reservations for that room
- Hotel subscribes Booking.com / Airbnb to this URL
- Updated immediately on reservation create/confirm/cancel

---

## Invoice Engine

### Generation
- Server-side PDF via `@react-pdf/renderer`
- Contents: hotel logo, name, address; guest name, email, phone; room, dates, nights, price/night, total; 48h payment deadline; Stripe payment link; bank transfer details (IBAN)
- Unique invoice reference number (e.g. `INV-2026-0042`)

### Delivery
- Sent via Resend to guest email
- Subject: `"Your reservation at [Hotel Name] — Invoice #XXX — Pay within 48 hours"`

### Payment options
- **Stripe payment link** (card, online) — primary
- **Bank transfer** (IBAN) — secondary, for guests who prefer it

### Lifecycle
- `sent` → guest receives email
- `paid` → Stripe webhook `payment_intent.succeeded` triggers confirmation
- `expired` → cron marks expired after 48h, triggers cancellation flow

---

## Notion CRM (via MCP)

### Hotel's Guest CRM (one Notion database per hotel tenant)
Each reservation creates/updates a Notion page:

| Field | Value |
|-------|-------|
| Guest Name | Full name |
| Email | Guest email |
| Phone | Guest phone |
| Room | Room name |
| Check-in | Date |
| Check-out | Date |
| Nights | Count |
| Total | Amount + currency |
| Status | On Hold / Confirmed / Cancelled |
| Invoice | Link to PDF |
| Source | Voice / Chat / Manual |

Hotel's `notion_database_id` stored in tenant settings. Connected via Notion OAuth during onboarding.

### Operator CRM (platform owner's Notion)
Each new hotel tenant creates a page:

| Field | Value |
|-------|-------|
| Hotel Name | Business name |
| Owner | Contact name |
| Email | Owner email |
| Phone | Owner phone |
| Setup Status | Pending / Configured / Live |
| Subscription | Trial / Active / Cancelled |
| MRR | Monthly subscription value |
| Notes | Free text |

Triggered on: tenant signup, subscription change, setup status update.

---

## Dashboard (hotel vertical)

| Page | Content |
|------|---------|
| Overview | Today's arrivals/departures, rooms on hold, confirmed bookings, monthly revenue |
| Rooms | Room list, add/edit room, iCal URL input, sync status indicator |
| Reservations | Calendar view + list, filter by status |
| Guests | Guest history, searchable by name/email/phone |
| Invoices | Invoice list, status, resend button, download PDF |
| AI Config | Welcome message, FAQs, pricing rules, language settings |
| Settings | Stripe connect, Notion connect, email config, subscription |

---

## Onboarding Wizard

### Phase 1 — White-glove (operator completes on behalf of hotel)
5-step wizard you fill in after the hotel pays the setup fee:
1. **Hotel profile** — name, address, phone, languages (English + local)
2. **Rooms setup** — add rooms: name, type, capacity, price, amenities
3. **iCal sync** — paste Booking.com / Airbnb iCal URLs per room
4. **Integrations** — connect Stripe (for guest payments) + Notion (guest CRM)
5. **AI config** — welcome message, FAQs, go live

### Phase 2 — Self-serve (hotel owner completes themselves)
Same wizard, accessible after signup. "Request help" button on each step lets them upgrade to white-glove at any point.

---

## Operator Admin Dashboard

Separate view (gated to platform owner account):
- List of all hotel tenants with subscription status, MRR, setup stage
- Quick actions: view tenant, resend setup email, mark as configured
- Revenue summary

---

## Pricing & Business Model

| Plan | Price | Rooms | Notes |
|------|-------|-------|-------|
| Setup fee | €299 one-time | — | White-glove configuration by operator |
| Starter | €79/month | Up to 10 | Voice + chat + Notion + invoices |
| Growth | €149/month | Up to 30 | + Priority support + custom widget branding |
| Pro | €249/month | Unlimited | + Multi-property + dedicated onboarding |

- 7-day free trial after go-live
- Setup fee collected via manual Stripe payment link (phase 1), via platform checkout (phase 2)
- Monthly subscription via existing Stripe Subscription infrastructure

---

## Implementation Phases

### Phase 1 — Core hotel vertical (ship first)
- DB schema migration (rooms, room_reservations, invoices, ical_blocks)
- Room management CRUD + hotel dashboard pages
- iCal import cron + export endpoint
- Vapi tools: check_room_availability, create_reservation, get_hotel_info
- Invoice PDF generation + Resend email
- Stripe payment link integration + webhook handler
- 48h cron (expiry + cancellation flow)
- Notion MCP: hotel guest CRM sync
- Operator CRM Notion sync

### Phase 2 — Self-serve & polish
- Self-serve onboarding wizard
- Notion OAuth connect flow for hotels
- Operator admin dashboard
- Custom widget branding
- Multi-property support
