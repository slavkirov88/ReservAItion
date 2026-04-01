# Deposit System Design

## Goal
When a reservation is made (via AI phone or chat), the system sends a proforma invoice to the guest via email, blocks the dates for 48 hours, and waits for the hotel to confirm bank transfer payment. If payment is not confirmed within 48 hours, the reservation is cancelled and dates are released.

## Architecture

### Database migration (new migration file: `006_deposit_system.sql`)

**`business_profiles` table — new columns:**
- `bank_iban` TEXT — hotel's IBAN
- `bank_name` TEXT — bank name (e.g. "UniCredit Bulbank")
- `company_name` TEXT — hotel legal company name
- `company_address` TEXT — hotel company address
- `deposit_percent` INTEGER DEFAULT 30 — deposit % of total reservation value

**`reservations` table — new columns:**
- `guest_email` TEXT NULLABLE — guest email for proforma
- `total_amount` NUMERIC NULLABLE — total reservation cost in EUR (entered manually or calculated from room price × nights)
- `deposit_amount` NUMERIC NULLABLE — calculated deposit: `ROUND(total_amount * deposit_percent / 100, 2)`
- `deposit_expires_at` TIMESTAMPTZ NULLABLE — set to `NOW() + INTERVAL '48 hours'` when status is `pending_payment`

**`reservations.status` enum — change approach:**
The existing status column is TEXT (not a Postgres enum), so simply allow new value `pending_payment`. Update TypeScript type in `database.ts`:
```typescript
status: 'confirmed' | 'cancelled' | 'no_show' | 'completed' | 'pending_payment'
```

### Reservation status flow
- `pending_payment` → new reservation awaiting deposit (dates blocked same as `confirmed`)
- `confirmed` → deposit confirmed by hotel owner
- `cancelled` → expired or manually cancelled (dates released)

**Availability check:** `pending_payment` reservations block dates identically to `confirmed`. Update `src/lib/availability.ts` to include `pending_payment` in the status filter.

### Deposit calculation
At reservation creation time (in the booking API):
```
deposit_amount = ROUND(total_amount * deposit_percent / 100, 2)
```
If `total_amount` is null or 0: skip deposit flow entirely — reservation goes straight to `confirmed` status and no proforma email is sent.

### Email system (Resend)
Two emails on reservation creation when `guest_email` is present AND `total_amount > 0`:

1. **To guest** (HTML proforma):
   - Hotel company name, address, IBAN, bank name
   - Reservation details: guest name, room type, check-in/out, total amount, deposit amount
   - Deadline: 48 hours from now
   - Bank transfer instructions

2. **To hotel owner** (notification):
   - "Нова резервация чака капаро" with reservation summary

**Relationship to existing email functions:** The existing `sendReservationConfirmation` in `/src/app/api/public/book/route.ts` sends a standard confirmation. For `pending_payment` reservations, replace this with the proforma email. For reservations without email/amount (legacy), keep existing behaviour.

### Cron job (`/api/cron/expire-deposits`)
- **Schedule:** every hour
- **Auth:** `Authorization: Bearer ${CRON_SECRET}` header check
- **Logic:** find all reservations where `status = 'pending_payment'` AND `deposit_expires_at < NOW()` → set `status = 'cancelled'`
- **`vercel.json` entry required:**
```json
{
  "crons": [{ "path": "/api/cron/expire-deposits", "schedule": "0 * * * *" }]
}
```
Add `CRON_SECRET` to Vercel environment variables.

### API endpoints

**`POST /api/reservations/[id]/confirm-deposit`**
- Auth: requires hotel owner session (Supabase auth + tenant ownership check)
- Sets `status = 'confirmed'`, clears `deposit_expires_at`
- Sends confirmation email to guest (if `guest_email` present)

**`GET /api/cron/expire-deposits`**
- Auth: `Authorization: Bearer ${CRON_SECRET}`
- Expires pending_payment reservations past their deadline

## UI changes

### Settings → Profile — new section "Банкови данни и капаро"
- IBAN field (text input)
- Bank name field (text input)
- Company name field (text input)
- Company address field (textarea)
- Deposit % field (number input, 1-100, default 30)
- Save button

### Reservations table
- New badge `Чака капаро` (amber/yellow) for `pending_payment` status
- "Потвърди плащане" button on `pending_payment` rows → calls confirm-deposit endpoint
- Countdown: "остават Xч" calculated from `deposit_expires_at`

### Reservation create form
- Add `guest_email` field (optional — required only if deposit flow desired)
- Add `total_amount` field (optional — if blank, no deposit flow)

### `database.ts` TypeScript updates
Update `ReservationRow` type to include: `guest_email`, `total_amount`, `deposit_amount`, `deposit_expires_at`, and add `pending_payment` to status union.

## Files to create/modify
- `supabase/migrations/006_deposit_system.sql` — DB migration
- `src/types/database.ts` — add new fields to ReservationRow
- `src/lib/availability.ts` — include pending_payment in blocked dates check
- `src/lib/email/templates.ts` — proforma HTML template
- `src/app/api/reservations/[id]/confirm-deposit/route.ts` — new endpoint
- `src/app/api/cron/expire-deposits/route.ts` — new cron endpoint
- `src/app/api/public/book/route.ts` — add deposit logic
- `src/app/api/chat/[apiKey]/route.ts` — pass guest_email + total_amount in book_reservation tool
- `src/app/api/vapi/[tenantId]/tool-call/route.ts` — same
- `src/components/settings/ProfileEditor.tsx` — add bank details fields
- `src/components/reservations/ReservationsTable.tsx` (or equivalent) — add badge + confirm button
- `vercel.json` — add crons entry
- `CRON_SECRET` — new env var in Vercel

## Out of scope (MVP)
- PDF generation (HTML email is sufficient)
- Stripe Connect / online card payment
- Automatic payment verification
- Guest portal to track payment status
- Partial deposits or multiple deposit instalments
