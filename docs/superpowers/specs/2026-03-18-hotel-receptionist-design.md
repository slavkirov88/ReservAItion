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
| i18n | next-intl (Bulgarian default, English toggle) |
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

Hotel Stripe plans are defined in a new `HOTEL_PLANS` constant in `src/lib/stripe/hotel-plans.ts` (separate from the existing `PLANS` in `stripe.ts`) to avoid colliding with healthcare billing. The existing healthcare billing is untouched.

---

## Database Schema (new tables)

```sql
-- Extend existing tenants table
ALTER TABLE tenants
  ADD COLUMN business_type TEXT DEFAULT 'clinic',
  ADD COLUMN notion_access_token TEXT,   -- hotel's Notion OAuth token
  ADD COLUMN notion_database_id TEXT;    -- hotel's guest CRM database ID
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

-- check_out is the departure date (exclusive bound).
-- A guest checking out on the 10th and a guest checking in on the 10th do NOT conflict.
-- All availability queries use the half-open interval [check_in, check_out).
room_reservations
  id              UUID PK
  tenant_id       UUID → tenants
  room_id         UUID → rooms
  guest_name      TEXT
  guest_email     TEXT
  guest_phone     TEXT          -- required, collected by agent
  check_in        DATE          -- inclusive arrival date
  check_out       DATE          -- exclusive departure date
  nights          INT GENERATED ALWAYS AS (check_out - check_in) STORED
  total_price     DECIMAL
  status          TEXT          -- 'on_hold' | 'confirmed' | 'cancelled'
  invoice_id      UUID → invoices (nullable until invoice is created)
  held_until      TIMESTAMPTZ   -- created_at + 48h; cron cancels after this
  source          TEXT          -- 'voice' | 'chat' | 'manual'
  created_at      TIMESTAMPTZ

-- Exclusion constraint to prevent double-booking at the DB level:
-- ALTER TABLE room_reservations
--   ADD CONSTRAINT no_double_booking
--   EXCLUDE USING gist (
--     room_id WITH =,
--     daterange(check_in, check_out, '[)') WITH &&
--   )
--   WHERE (status IN ('on_hold', 'confirmed'));
--
-- create_reservation must catch the resulting constraint violation and
-- return a graceful "room just became unavailable" message to the agent.

-- invoices is created FIRST; room_reservations.invoice_id is set after insert.
-- invoices has NO back-reference FK to room_reservations to avoid circular dependency.
-- The relationship is: room_reservations.invoice_id → invoices (one direction only).
invoices
  id                    UUID PK
  tenant_id             UUID → tenants
  guest_email           TEXT
  guest_phone           TEXT
  amount                DECIMAL
  currency              TEXT
  pdf_url               TEXT
  stripe_payment_link   TEXT
  stripe_event_id       TEXT     -- last processed Stripe event ID for idempotency
  status                TEXT     -- 'sent' | 'paid' | 'expired'
  sent_at               TIMESTAMPTZ
  expires_at            TIMESTAMPTZ   -- sent_at + 48h
  paid_at               TIMESTAMPTZ

ical_blocks
  id          UUID PK
  tenant_id   UUID → tenants    -- denormalised for RLS; matches rooms.tenant_id
  room_id     UUID → rooms
  source      TEXT              -- 'booking.com' | 'airbnb' | 'manual'
  start_date  DATE
  end_date    DATE              -- exclusive (same convention as check_out)
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
  → uses half-open interval [check_in, check_out) for overlap detection
  → returns available rooms with prices
       │
       ▼
Agent presents options, confirms price with guest
       │
       ▼
Collects: guest name, email, phone (all required)
       │
       ▼
create_reservation(room_id, guest_details, dates)
  → BEGIN transaction
  → INSERT into invoices first (returns invoice_id)
  → INSERT into room_reservations with invoice_id (status='on_hold', held_until=now+48h)
    -- DB exclusion constraint fires here if room just became unavailable
    -- On constraint violation: rollback, agent says "room just became unavailable"
  → COMMIT
  → Generate PDF invoice (async)
  → Create Stripe payment link
  → Send invoice email via Resend
  → Update iCal export
  → Create Notion page in hotel's guest CRM (Phase 1: operator CRM only; hotel guest CRM in Phase 2)
       │
       ▼
Agent confirms: "Invoice sent to [email]. Pay within 48 hours to secure your booking."
       │
    ┌──┴──────────────────┐
  paid (Stripe webhook)     not paid (cron after 48h)
    │                            │
  Webhook handler checks:      status → cancelled
  - if invoices.status='paid'  Notion updated
    already → return 200,      iCal dates released
    exit (idempotent)          cancellation email to guest
  - if invoices.status='expired'
    (cron already cancelled) →
    issue Stripe refund,
    send "refund issued" email,
    return 200
  - else → status → confirmed
    Notion updated
    iCal confirmed
    confirmation email
```

### Vapi tools (hotel vertical)

| Tool | Description |
|------|-------------|
| `check_room_availability` | Query live DB + iCal blocks for available rooms |
| `create_reservation` | Create on_hold reservation, generate invoice, send email |
| `get_hotel_info` | FAQs, amenities, policies, check-in/out times, location |
| `cancel_reservation` | Cancel by reference number — requires verification (see below) |

### `cancel_reservation` verification
Before executing cancellation, the agent must verify the caller's identity:
1. Ask for reservation reference number
2. Ask for the last 4 digits of the phone number used when booking

Both must match a `room_reservations` row. On mismatch after 2 attempts, the agent declines and directs the guest to contact the hotel directly.

---

## iCal Sync

### Import (blocking external dates)
- Hotel pastes Booking.com / Airbnb iCal feed URL per room during setup
- Supabase Edge Function cron runs every 30 minutes, fetches each `ical_url`, parses events, upserts into `ical_blocks`
- **Error isolation:** each room is processed independently. If a fetch returns non-200 or malformed iCal, that room is skipped and the error is logged; the cron continues with other rooms. `ical_blocks` for a room are only replaced on a successful fetch (stale blocks are preserved on failure).
- `check_room_availability` combines `room_reservations` (on_hold + confirmed) + `ical_blocks` using the `[check_in, check_out)` half-open interval

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
- **Stripe payment link** (card, online) — primary; automated confirmation via webhook
- **Bank transfer** (IBAN) — secondary. Bank transfer confirmations require **manual operator action** via the dashboard (operator marks invoice as paid). There is no automated webhook for bank transfers in Phase 1.

### Lifecycle
- `sent` → guest receives email
- `paid` → Stripe webhook `checkout.session.completed` triggers confirmation (Payment Links emit this event, not `payment_intent.succeeded`). The handler resolves the `invoices` row via metadata embedded in the payment link at creation time (`metadata.invoice_id`). It then fetches the associated `room_reservations` row via `SELECT * FROM room_reservations WHERE invoice_id = $invoice_id` — no back-reference FK needed. See idempotency rules in booking flow above.
- `expired` → cron marks expired after 48h, triggers cancellation flow; if guest pays after expiry, automatic refund is issued

---

## Notion CRM (via MCP)

### Authentication model
- The platform uses a **single Notion MCP integration** (platform-level API key) for the **Operator CRM** — no per-tenant OAuth needed.
- For **hotel guest CRMs**, each hotel connects their own Notion workspace via Notion OAuth during onboarding. Their `notion_access_token` and `notion_database_id` are stored on the `tenants` row. The MCP client is initialised per-request using the tenant's token.
- **Phase 1 scope:** only the Operator CRM is implemented (platform-level, no per-tenant OAuth). Hotel guest CRM Notion sync is a **Phase 2** feature, dependent on the Notion OAuth connect flow.

### Hotel's Guest CRM — Phase 2 (one Notion database per hotel tenant)
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

### Operator CRM — Phase 1 (platform owner's Notion, single integration)
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
| Invoices | Invoice list, status, resend button, download PDF, manual "mark as paid" for bank transfers |
| AI Config | Welcome message, FAQs, pricing rules, language settings |
| Settings | Stripe connect, Notion connect (Phase 2), email config, subscription |

---

## Onboarding Wizard

### Phase 1 — White-glove (operator completes on behalf of hotel)
5-step wizard the operator fills in after the hotel pays the setup fee:
1. **Hotel profile** — name, address, phone, languages (English + local)
2. **Rooms setup** — add rooms: name, type, capacity, price, amenities
3. **iCal sync** — paste Booking.com / Airbnb iCal URLs per room
4. **Integrations** — connect Stripe (for guest payments); Notion guest CRM skipped until Phase 2
5. **AI config** — welcome message, FAQs, go live

### Phase 2 — Self-serve (hotel owner completes themselves)
Same wizard, accessible after signup. "Request help" button on each step lets them upgrade to white-glove at any point. Adds Notion OAuth connect step.

---

## Operator Admin Dashboard

Separate view (gated to platform owner account):
- List of all hotel tenants with subscription status, MRR, setup stage
- Quick actions: view tenant, resend setup email, mark as configured, manual invoice mark-as-paid
- Revenue summary

---

## Pricing & Business Model

Hotel plans live in `src/lib/stripe/hotel-plans.ts` as `HOTEL_PLANS` — separate from the existing healthcare `PLANS` in `stripe.ts`.

| Plan | Price | Rooms | Notes |
|------|-------|-------|-------|
| Setup fee | €299 one-time | — | White-glove configuration by operator |
| Starter | €79/month | Up to 10 | Voice + chat + invoices + operator Notion CRM |
| Growth | €149/month | Up to 30 | + Priority support + custom widget branding |
| Pro | €249/month | Unlimited | + Multi-property + dedicated onboarding |

- **7-day free trial** starts when the operator marks the hotel as "Live" in the admin dashboard, which sets `trial_ends_at = now() + 7 days` on the tenant row (consistent with existing middleware check in `src/lib/supabase/middleware.ts`)
- Setup fee collected via manual Stripe payment link (phase 1), via platform checkout (phase 2)
- Monthly subscription via existing Stripe Subscription infrastructure

---

## Dashboard i18n (Bulgarian / English)

The dashboard UI is fully internationalised using **next-intl**.

- **Default language:** Bulgarian (`bg`)
- **Available languages:** Bulgarian + English (`en`)
- **Toggle:** a `BG / EN` button in the top navigation bar, visible on every page, accessible to all users
- **Persistence:** selected language stored in a cookie (`NEXT_LOCALE`); survives page refresh and re-login
- **Scope:** all dashboard UI strings, onboarding wizard, error messages, email templates sent to hotel owners. Guest-facing invoice emails respect the hotel's configured guest language (not this toggle).
- **Translation files:** `messages/bg.json` and `messages/en.json` — flat key-value structure, one file per language
- **No URL-based locale prefix** (e.g. no `/bg/dashboard`) — the toggle switches locale in-place via cookie, keeping URLs clean

This is a **Phase 1** deliverable — Bulgarian support ships with the initial hotel vertical.

---

## Implementation Phases

### Phase 1 — Core hotel vertical (ship first)
- **i18n setup:** `next-intl`, `messages/bg.json` + `messages/en.json`, `BG/EN` toggle in nav
- `HOTEL_PLANS` constant in `src/lib/stripe/hotel-plans.ts`
- DB schema migration: `business_type` + Notion columns on `tenants`; new tables `rooms`, `room_reservations`, `invoices`, `ical_blocks` with exclusion constraint
- Room management CRUD + hotel dashboard pages
- iCal import cron (per-room error isolation) + export endpoint
- Vapi tools: `check_room_availability`, `create_reservation` (with race condition handling), `get_hotel_info`, `cancel_reservation` (with phone verification)
- Invoice PDF generation (`@react-pdf/renderer`) + Resend email
- Stripe payment link integration + idempotent webhook handler (with post-cancellation refund path)
- 48h cron (expiry + cancellation flow)
- **Notion: Operator CRM sync only** (platform-level MCP key)
- Manual "mark as paid" for bank transfers in dashboard

### Phase 2 — Self-serve & polish
- Self-serve onboarding wizard
- Notion OAuth connect flow for hotel guest CRMs
- Hotel guest Notion CRM sync
- Operator admin dashboard
- Custom widget branding
- Multi-property support
