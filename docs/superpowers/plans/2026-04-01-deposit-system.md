# Deposit System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When a reservation is made via AI, send a proforma invoice to the guest, block dates for 48 hours, and auto-cancel if the hotel owner doesn't confirm bank transfer payment within 48 hours.

**Architecture:** New `pending_payment` reservation status blocks dates same as `confirmed`. Resend sends proforma HTML to guest + notification to owner. Vercel Cron expires overdue reservations hourly. Hotel owner confirms payment via dashboard button.

**Tech Stack:** Supabase PostgreSQL, Next.js App Router API routes, Resend (email), Vercel Cron Jobs, TypeScript, shadcn/ui

**Spec:** `docs/superpowers/specs/2026-04-01-deposit-system-design.md`

**Key architectural note:** The profile settings API (`/api/settings/profile`) reads/writes the `tenants` table — not `business_profiles`. Bank detail columns therefore go on `tenants` for consistency with the existing pattern.

**Out of scope (MVP):** Manual reservation create form fields for guest_email/total_amount. Reservation create form is admin-only; deposit flow is AI-triggered only.

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `supabase/migrations/006_deposit_system.sql` | Create | New columns: bank_iban, bank_name, company_name, company_address, deposit_percent on tenants; guest_email, total_amount, deposit_amount, deposit_expires_at on reservations |
| `src/types/database.ts` | Modify | Add new fields to ReservationRow + insert/update; add `pending_payment` to status union; add bank fields to TenantRow |
| `src/lib/availability.ts` | Modify | Add `'pending_payment'` to `.in('status', [...])` filter |
| `src/lib/email/templates/proforma.ts` | Create | HTML proforma template for guest + owner notification for pending payment |
| `src/lib/email/resend.ts` | Modify | Add `sendProformaToGuest()` and `sendDepositOwnerNotification()` functions |
| `src/app/api/reservations/[id]/confirm-deposit/route.ts` | Create | POST: sets status=confirmed, clears deposit_expires_at, sends confirmation email |
| `src/app/api/cron/expire-deposits/route.ts` | Create | GET: auth with CRON_SECRET + service client, expires pending_payment reservations past deadline |
| `src/app/api/public/book/route.ts` | Modify | Deposit flow: if guest_email + total_amount → status=pending_payment + proforma; also fix .in('status') check to include pending_payment |
| `src/app/api/chat/[apiKey]/route.ts` | Modify | Pass guest_email + total_amount from book_reservation tool call to /api/public/book |
| `src/app/api/vapi/[tenantId]/tool-call/route.ts` | Modify | Pass guest_email + total_amount when calling book_reservation |
| `src/components/settings/ProfileEditor.tsx` | Modify | Add bank details section: IBAN, bank name, company name, company address, deposit % |
| `src/app/api/settings/profile/route.ts` | Modify | Include bank fields in GET select and PUT update on tenants table |
| `src/components/reservations/ReservationTable.tsx` | Modify | Add pending_payment badge, confirm button, countdown |
| `vercel.json` | Modify | Add crons entry for /api/cron/expire-deposits |

---

## Task 1: DB Migration

**Files:**
- Create: `supabase/migrations/006_deposit_system.sql`

- [ ] **Step 1: Write migration SQL**

```sql
-- 006_deposit_system.sql

ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS bank_iban TEXT,
  ADD COLUMN IF NOT EXISTS bank_name TEXT,
  ADD COLUMN IF NOT EXISTS company_name TEXT,
  ADD COLUMN IF NOT EXISTS company_address TEXT,
  ADD COLUMN IF NOT EXISTS deposit_percent INTEGER DEFAULT 30;

ALTER TABLE reservations
  ADD COLUMN IF NOT EXISTS guest_email TEXT,
  ADD COLUMN IF NOT EXISTS total_amount NUMERIC,
  ADD COLUMN IF NOT EXISTS deposit_amount NUMERIC,
  ADD COLUMN IF NOT EXISTS deposit_expires_at TIMESTAMPTZ;
```

- [ ] **Step 2: Run migration in Supabase SQL Editor**

Go to Supabase → SQL Editor → paste and run the SQL above.

- [ ] **Step 3: Verify columns exist**

Run in SQL Editor:
```sql
SELECT column_name FROM information_schema.columns
WHERE table_name = 'tenants' AND column_name IN ('bank_iban','bank_name','company_name','company_address','deposit_percent');

SELECT column_name FROM information_schema.columns
WHERE table_name = 'reservations' AND column_name IN ('guest_email','total_amount','deposit_amount','deposit_expires_at');
```
Expected: 5 rows for tenants, 4 rows for reservations.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/006_deposit_system.sql
git commit -m "feat: add 006_deposit_system migration — bank details + deposit fields"
```

---

## Task 2: TypeScript Types Update

**Files:**
- Modify: `src/types/database.ts`

Read the full file first, then make these changes:

- [ ] **Step 1: Add `pending_payment` to ReservationRow status union**

Change:
```typescript
status: 'confirmed' | 'cancelled' | 'no_show' | 'completed'
```
to:
```typescript
status: 'confirmed' | 'cancelled' | 'no_show' | 'completed' | 'pending_payment'
```

- [ ] **Step 2: Add deposit fields to ReservationRow**

Add these fields to `ReservationRow` (after existing fields):
```typescript
guest_email: string | null
total_amount: number | null
deposit_amount: number | null
deposit_expires_at: string | null
```

- [ ] **Step 3: Add same fields to ReservationInsert and ReservationUpdate as optional**

```typescript
guest_email?: string | null
total_amount?: number | null
deposit_amount?: number | null
deposit_expires_at?: string | null
```

- [ ] **Step 4: Add bank detail fields to TenantRow (or the equivalent tenant type)**

Find the type that maps to the `tenants` table and add:
```typescript
bank_iban: string | null
bank_name: string | null
company_name: string | null
company_address: string | null
deposit_percent: number
```

Also add same as optional fields to the tenant update/insert types.

- [ ] **Step 5: Run TypeScript check**

```bash
npx tsc --noEmit 2>&1 | head -30
```
Expected: 0 errors related to new fields.

- [ ] **Step 6: Commit**

```bash
git add src/types/database.ts
git commit -m "feat: add deposit fields to TypeScript database types"
```

---

## Task 3: Availability Fix

**Files:**
- Modify: `src/lib/availability.ts`

- [ ] **Step 1: Find the status filter line**

In `src/lib/availability.ts`, find the line (around line 102):
```typescript
.in('status', ['confirmed'])
```

- [ ] **Step 2: Add pending_payment**

Change to:
```typescript
.in('status', ['confirmed', 'pending_payment'])
```

- [ ] **Step 3: Search for any other status filters in the file**

```bash
grep -n "in('status'" src/lib/availability.ts
```

Fix any other occurrences that should block dates.

- [ ] **Step 4: Commit**

```bash
git add src/lib/availability.ts
git commit -m "feat: pending_payment blocks dates same as confirmed in availability check"
```

---

## Task 4: Proforma Email Template + Resend Functions

**Files:**
- Create: `src/lib/email/templates/proforma.ts`
- Modify: `src/lib/email/resend.ts`

- [ ] **Step 1: Read existing template files to understand the pattern**

Read `src/lib/email/templates/reservation-confirmation.ts` and `src/lib/email/templates/owner-notification.ts` to understand the export pattern and `ReservationEmailData` interface fields.

- [ ] **Step 2: Create proforma template file**

Create `src/lib/email/templates/proforma.ts`:

```typescript
export interface ProformaEmailData {
  guestName: string
  roomTypeName: string
  checkInDate: string
  checkOutDate: string
  totalAmount: number
  depositAmount: number
  depositPercent: number
  deadlineDate: string
  hotelName: string
  companyName: string
  companyAddress: string
  bankIban: string
  bankName: string
}

export interface DepositOwnerNotificationData {
  guestName: string
  guestEmail: string
  guestPhone: string
  roomTypeName: string
  checkInDate: string
  checkOutDate: string
  totalAmount: number
  depositAmount: number
  deadlineDate: string
}

export function proformaSubject(hotelName: string): string {
  return `Проформа фактура — ${hotelName}`
}

export function proformaHtml(d: ProformaEmailData): string {
  return `<!DOCTYPE html>
<html lang="bg">
<head><meta charset="UTF-8"><style>
  body { font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
  h1 { color: #1a1a2e; font-size: 22px; }
  h2 { color: #444; font-size: 16px; border-bottom: 1px solid #eee; padding-bottom: 8px; }
  table { width: 100%; border-collapse: collapse; margin: 16px 0; }
  td { padding: 8px 4px; border-bottom: 1px solid #f0f0f0; }
  td:first-child { color: #666; width: 45%; }
  .amount { font-size: 20px; font-weight: bold; color: #1a1a2e; }
  .bank-box { background: #f8f9fa; border: 1px solid #e0e0e0; border-radius: 8px; padding: 16px; margin: 20px 0; }
  .deadline { background: #fff3cd; border: 1px solid #ffc107; border-radius: 6px; padding: 12px; margin: 16px 0; }
  .footer { font-size: 12px; color: #999; margin-top: 32px; }
</style></head>
<body>
  <h1>Проформа фактура</h1>
  <p>Уважаеми/а <strong>${d.guestName}</strong>,</p>
  <p>Благодарим Ви за резервацията в <strong>${d.hotelName}</strong>. Моля, извършете плащане на капарото в рамките на 48 часа за потвърждение на резервацията.</p>

  <h2>Детайли на резервацията</h2>
  <table>
    <tr><td>Стая</td><td>${d.roomTypeName}</td></tr>
    <tr><td>Настаняване</td><td>${d.checkInDate}</td></tr>
    <tr><td>Напускане</td><td>${d.checkOutDate}</td></tr>
    <tr><td>Обща сума</td><td>${d.totalAmount.toFixed(2)} EUR</td></tr>
    <tr><td>Капаро (${d.depositPercent}%)</td><td class="amount">${d.depositAmount.toFixed(2)} EUR</td></tr>
  </table>

  <div class="deadline">
    ⏰ <strong>Краен срок за плащане: ${d.deadlineDate}</strong><br>
    При неплащане в срок резервацията се анулира автоматично.
  </div>

  <div class="bank-box">
    <h2 style="border:none;margin-top:0;">Банкови данни за превод</h2>
    <table>
      <tr><td>Получател</td><td><strong>${d.companyName}</strong></td></tr>
      <tr><td>Адрес</td><td>${d.companyAddress}</td></tr>
      <tr><td>IBAN</td><td><strong>${d.bankIban}</strong></td></tr>
      <tr><td>Банка</td><td>${d.bankName}</td></tr>
      <tr><td>Основание</td><td>Капаро — ${d.guestName} — ${d.checkInDate}</td></tr>
      <tr><td>Сума</td><td><strong>${d.depositAmount.toFixed(2)} EUR</strong></td></tr>
    </table>
  </div>

  <p>При въпроси не се колебайте да се свържете с нас.</p>
  <p>С уважение,<br><strong>${d.hotelName}</strong></p>
  <div class="footer">Powered by ReservAItion</div>
</body>
</html>`
}

export function depositOwnerNotificationSubject(guestName: string): string {
  return `Нова резервация чака капаро — ${guestName}`
}

export function depositOwnerNotificationHtml(d: DepositOwnerNotificationData): string {
  return `<!DOCTYPE html>
<html lang="bg">
<head><meta charset="UTF-8"><style>
  body { font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
  h1 { color: #1a1a2e; font-size: 20px; }
  table { width: 100%; border-collapse: collapse; margin: 16px 0; }
  td { padding: 8px 4px; border-bottom: 1px solid #f0f0f0; }
  td:first-child { color: #666; width: 45%; }
  .amount { font-weight: bold; color: #1a1a2e; }
  .deadline { background: #fff3cd; border: 1px solid #ffc107; border-radius: 6px; padding: 12px; margin: 16px 0; }
</style></head>
<body>
  <h1>Нова резервация чака капаро</h1>
  <table>
    <tr><td>Гост</td><td><strong>${d.guestName}</strong></td></tr>
    <tr><td>Имейл</td><td>${d.guestEmail}</td></tr>
    <tr><td>Телефон</td><td>${d.guestPhone}</td></tr>
    <tr><td>Стая</td><td>${d.roomTypeName}</td></tr>
    <tr><td>Настаняване</td><td>${d.checkInDate}</td></tr>
    <tr><td>Напускане</td><td>${d.checkOutDate}</td></tr>
    <tr><td>Обща сума</td><td>${d.totalAmount.toFixed(2)} EUR</td></tr>
    <tr><td>Капаро</td><td class="amount">${d.depositAmount.toFixed(2)} EUR</td></tr>
  </table>
  <div class="deadline">⏰ Краен срок за потвърждение: <strong>${d.deadlineDate}</strong></div>
  <p>Влезте в панела, за да потвърдите плащането след получаване на превода.</p>
</body>
</html>`
}
```

- [ ] **Step 3: Add imports and new send functions to resend.ts**

At the top of `src/lib/email/resend.ts`, add imports:
```typescript
import {
  proformaHtml,
  proformaSubject,
  depositOwnerNotificationHtml,
  depositOwnerNotificationSubject,
  type ProformaEmailData,
  type DepositOwnerNotificationData,
} from './templates/proforma'
```

After existing exported functions, add:
```typescript
export async function sendProformaToGuest(
  toEmail: string,
  data: ProformaEmailData
): Promise<void> {
  const resend = getResendClient()
  if (!resend) return
  try {
    await resend.emails.send({
      from: `${data.hotelName} <reservations@reservaition.com>`,
      to: toEmail,
      subject: proformaSubject(data.hotelName),
      html: proformaHtml(data),
    })
  } catch (err) {
    console.error('[Email] Failed to send proforma:', err)
  }
}

export async function sendDepositOwnerNotification(
  ownerEmail: string,
  data: DepositOwnerNotificationData
): Promise<void> {
  const resend = getResendClient()
  if (!resend) return
  try {
    await resend.emails.send({
      from: 'ReservAItion <notifications@reservaition.com>',
      to: ownerEmail,
      subject: depositOwnerNotificationSubject(data.guestName),
      html: depositOwnerNotificationHtml(data),
    })
  } catch (err) {
    console.error('[Email] Failed to send deposit owner notification:', err)
  }
}
```

- [ ] **Step 4: Run TypeScript check**

```bash
npx tsc --noEmit 2>&1 | head -30
```
Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
git add src/lib/email/templates/proforma.ts src/lib/email/resend.ts
git commit -m "feat: proforma email template and send functions"
```

---

## Task 5: Confirm-Deposit API Endpoint

**Files:**
- Create: `src/app/api/reservations/[id]/confirm-deposit/route.ts`

- [ ] **Step 1: Read the reservation-confirmation template to get exact ReservationEmailData fields**

Read `src/lib/email/templates/reservation-confirmation.ts` to confirm the exact field names in `ReservationEmailData` before writing the code.

- [ ] **Step 2: Create the endpoint**

Create `src/app/api/reservations/[id]/confirm-deposit/route.ts`. The `sendReservationConfirmation` call must use the exact field names from `ReservationEmailData` (verified in Step 1):

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendReservationConfirmation } from '@/lib/email/resend'

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Fetch reservation and verify tenant ownership
  const { data: reservation, error: fetchError } = await supabase
    .from('reservations')
    .select('*, tenants!inner(owner_id, business_name)')
    .eq('id', id)
    .eq('tenants.owner_id', user.id)
    .single()

  if (fetchError || !reservation) {
    return NextResponse.json({ error: 'Reservation not found' }, { status: 404 })
  }

  if (reservation.status !== 'pending_payment') {
    return NextResponse.json({ error: 'Reservation is not pending payment' }, { status: 400 })
  }

  const { error: updateError } = await supabase
    .from('reservations')
    .update({ status: 'confirmed', deposit_expires_at: null })
    .eq('id', id)

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  // Send confirmation email to guest if email present
  // Use the exact field names from ReservationEmailData (verified in Step 1)
  if (reservation.guest_email) {
    const tenant = reservation.tenants as { business_name?: string }
    await sendReservationConfirmation(reservation.guest_email, {
      guestName: reservation.guest_name,
      hotelName: tenant?.business_name || 'Хотел',
      checkInDate: reservation.check_in_date,
      checkOutDate: reservation.check_out_date || '',
      // Add any other required fields per ReservationEmailData interface
    } as Parameters<typeof sendReservationConfirmation>[1])
  }

  return NextResponse.json({ success: true })
}
```

- [ ] **Step 3: Run TypeScript check**

```bash
npx tsc --noEmit 2>&1 | head -30
```
Fix any type errors from the `sendReservationConfirmation` call by matching the exact interface.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/reservations/[id]/confirm-deposit/route.ts
git commit -m "feat: confirm-deposit API endpoint"
```

---

## Task 6: Cron Expiry Endpoint + vercel.json

**Files:**
- Create: `src/app/api/cron/expire-deposits/route.ts`
- Modify: `vercel.json`

- [ ] **Step 1: Create cron route using service client**

Note: Cron jobs have no user session. Use `createServiceClient()` so the route has permission to update reservations across all tenants.

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = await createServiceClient()

  const { data, error } = await supabase
    .from('reservations')
    .update({ status: 'cancelled' })
    .eq('status', 'pending_payment')
    .lt('deposit_expires_at', new Date().toISOString())
    .select('id')

  if (error) {
    console.error('[Cron] expire-deposits error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const count = data?.length ?? 0
  console.log(`[Cron] Expired ${count} pending_payment reservations`)
  return NextResponse.json({ expired: count })
}
```

- [ ] **Step 2: Add cron to vercel.json**

Read current `vercel.json`, then add the `crons` key:

```json
{
  "functions": {
    "src/app/api/vapi/**": { "maxDuration": 30 },
    "src/app/api/stripe/webhook": { "maxDuration": 10 }
  },
  "crons": [
    { "path": "/api/cron/expire-deposits", "schedule": "0 * * * *" }
  ]
}
```

- [ ] **Step 3: Add CRON_SECRET to .env.local**

In `.env.local`, add:
```
CRON_SECRET=replace-with-a-random-secret
```

Also add `CRON_SECRET` to Vercel environment variables (Settings → Environment Variables).

- [ ] **Step 4: Run TypeScript check**

```bash
npx tsc --noEmit 2>&1 | head -30
```

- [ ] **Step 5: Commit**

```bash
git add src/app/api/cron/expire-deposits/route.ts vercel.json
git commit -m "feat: cron job to expire pending_payment reservations after 48h"
```

---

## Task 7: Public Book Route — Deposit Flow

**Files:**
- Modify: `src/app/api/public/book/route.ts`

- [ ] **Step 1: Read the full current file**

Read `src/app/api/public/book/route.ts` in full before making changes.

- [ ] **Step 2: Fix the duplicate availability check**

The route has a `.in('status', ['confirmed'])` check to prevent double-booking (separate from `availability.ts`). Find it and change to:
```typescript
.in('status', ['confirmed', 'pending_payment'])
```

- [ ] **Step 3: Add guest_email, total_amount, room_type_name to body destructuring**

Find the existing destructuring at the top of the handler (e.g. `const { api_key, guest_name, ... } = body`) and add:
```typescript
guest_email, total_amount, room_type_name
```

These are optional fields — the body type should be updated to include:
```typescript
guest_email?: string
total_amount?: number | string
room_type_name?: string
```

- [ ] **Step 4: Add deposit logic after reservation creation**

Find where the reservation is created and the existing `sendReservationConfirmation` + `sendOwnerNotification` calls. Replace that section with:

```typescript
// Fetch tenant for deposit settings and owner email
const { data: tenantProfile } = await supabase
  .from('tenants')
  .select('id, business_name, bank_iban, bank_name, company_name, company_address, deposit_percent, owner_id')
  .eq('id', tenant.id)
  .single()

// Get owner email
let ownerEmail: string | undefined
if (tenantProfile?.owner_id) {
  const { data: ownerData } = await supabase.auth.admin.getUserById(tenantProfile.owner_id)
  ownerEmail = ownerData?.user?.email
}

const hotelName = tenantProfile?.business_name || tenant.business_name || 'Хотел'
const guestEmailVal: string | undefined = guest_email
const totalAmountVal: number | undefined = total_amount ? Number(total_amount) : undefined

const hasDepositFlow = guestEmailVal &&
  totalAmountVal && totalAmountVal > 0 &&
  tenantProfile?.bank_iban &&
  tenantProfile?.company_name

if (hasDepositFlow && totalAmountVal) {
  const depositPercent = tenantProfile.deposit_percent ?? 30
  const depositAmount = Math.round(totalAmountVal * depositPercent / 100 * 100) / 100
  const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString()

  await supabase
    .from('reservations')
    .update({
      status: 'pending_payment',
      guest_email: guestEmailVal,
      total_amount: totalAmountVal,
      deposit_amount: depositAmount,
      deposit_expires_at: expiresAt,
    })
    .eq('id', reservation.id)

  const deadlineFormatted = new Date(expiresAt).toLocaleDateString('bg-BG', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })

  await sendProformaToGuest(guestEmailVal, {
    guestName: guest_name,
    roomTypeName: room_type_name || room_type || '',
    checkInDate: check_in_date,
    checkOutDate: check_out_date || '',
    totalAmount: totalAmountVal,
    depositAmount,
    depositPercent,
    deadlineDate: deadlineFormatted,
    hotelName,
    companyName: tenantProfile.company_name!,
    companyAddress: tenantProfile.company_address || '',
    bankIban: tenantProfile.bank_iban!,
    bankName: tenantProfile.bank_name || '',
  })

  if (ownerEmail) {
    await sendDepositOwnerNotification(ownerEmail, {
      guestName: guest_name,
      guestEmail: guestEmailVal,
      guestPhone: guest_phone || '',
      roomTypeName: room_type_name || room_type || '',
      checkInDate: check_in_date,
      checkOutDate: check_out_date || '',
      totalAmount: totalAmountVal,
      depositAmount,
      deadlineDate: deadlineFormatted,
    })
  }
} else {
  // Legacy flow — no deposit
  if (guestEmailVal) {
    await sendReservationConfirmation(guestEmailVal, {
      guestName: guest_name,
      hotelName,
      checkInDate: check_in_date,
      checkOutDate: check_out_date || '',
      // Fill remaining fields per ReservationEmailData interface
    } as Parameters<typeof sendReservationConfirmation>[1])
  }
  if (ownerEmail) {
    await sendOwnerNotification(ownerEmail, {
      guestName: guest_name,
      guestPhone: guest_phone || '',
      channel: channel || 'ai',
      checkInDate: check_in_date,
      hotelName,
    } as Parameters<typeof sendOwnerNotification>[1])
  }
}
```

Add at the top imports:
```typescript
import { sendProformaToGuest, sendDepositOwnerNotification } from '@/lib/email/resend'
```

- [ ] **Step 5: Run TypeScript check and fix type errors**

```bash
npx tsc --noEmit 2>&1 | head -50
```

Fix any errors. Common ones: email data interface field mismatches, missing variables from destructuring.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/public/book/route.ts
git commit -m "feat: deposit flow in public booking API — pending_payment + proforma email"
```

---

## Task 8: Settings UI — Bank Details

**Files:**
- Modify: `src/components/settings/ProfileEditor.tsx`
- Modify: `src/app/api/settings/profile/route.ts`

- [ ] **Step 1: Read both files first**

Read `src/components/settings/ProfileEditor.tsx` and `src/app/api/settings/profile/route.ts` in full.

- [ ] **Step 2: Update profile API GET — add bank fields to select**

The current GET query:
```typescript
.select('business_name, slug, phone, address, languages, website_url, website_content')
```

Change to:
```typescript
.select('business_name, slug, phone, address, languages, website_url, website_content, bank_iban, bank_name, company_name, company_address, deposit_percent')
```

- [ ] **Step 3: Update profile API PUT — add bank fields to update body and query**

Change the body type and update payload to include:
```typescript
const body = await request.json() as {
  business_name?: string
  phone?: string
  address?: string
  bank_iban?: string
  bank_name?: string
  company_name?: string
  company_address?: string
  deposit_percent?: number
}

// In the update call, add:
bank_iban: body.bank_iban,
bank_name: body.bank_name,
company_name: body.company_name,
company_address: body.company_address,
deposit_percent: body.deposit_percent,
```

- [ ] **Step 4: Update ProfileEditor — extend ProfileData interface**

Add to the existing `ProfileData` interface (keep all existing fields):
```typescript
bank_iban: string
bank_name: string
company_name: string
company_address: string
deposit_percent: number
```

Update `useState` initial value to include:
```typescript
bank_iban: '', bank_name: '', company_name: '', company_address: '', deposit_percent: 30,
```

Update the `useEffect` fetch to map new fields:
```typescript
bank_iban: d.bank_iban || '',
bank_name: d.bank_name || '',
company_name: d.company_name || '',
company_address: d.company_address || '',
deposit_percent: d.deposit_percent ?? 30,
```

- [ ] **Step 5: Add bank details section to the form JSX**

After the existing Address field, add a bordered section:
```tsx
<div className="border-t pt-4 mt-2">
  <h3 className="text-sm font-semibold mb-3">Банкови данни и капаро</h3>
  <div className="space-y-4">
    <div className="space-y-2">
      <Label>Фирма (юридическо лице)</Label>
      <Input
        value={data.company_name}
        onChange={e => setData(d => ({ ...d, company_name: e.target.value }))}
        placeholder="ООД / ЕООД наименование"
      />
    </div>
    <div className="space-y-2">
      <Label>Адрес на фирмата</Label>
      <Input
        value={data.company_address}
        onChange={e => setData(d => ({ ...d, company_address: e.target.value }))}
        placeholder="ул. Витоша 15, София"
      />
    </div>
    <div className="space-y-2">
      <Label>IBAN</Label>
      <Input
        value={data.bank_iban}
        onChange={e => setData(d => ({ ...d, bank_iban: e.target.value }))}
        placeholder="BG80BNBG96611020345678"
      />
    </div>
    <div className="space-y-2">
      <Label>Банка</Label>
      <Input
        value={data.bank_name}
        onChange={e => setData(d => ({ ...d, bank_name: e.target.value }))}
        placeholder="UniCredit Bulbank"
      />
    </div>
    <div className="space-y-2">
      <Label>Капаро (%)</Label>
      <Input
        type="number"
        min={1}
        max={100}
        value={data.deposit_percent}
        onChange={e => setData(d => ({ ...d, deposit_percent: Number(e.target.value) }))}
      />
    </div>
  </div>
</div>
```

- [ ] **Step 6: Run TypeScript check**

```bash
npx tsc --noEmit 2>&1 | head -30
```

- [ ] **Step 7: Commit**

```bash
git add src/components/settings/ProfileEditor.tsx src/app/api/settings/profile/route.ts
git commit -m "feat: bank details and deposit % settings in ProfileEditor"
```

---

## Task 9: Reservations Table — Pending Payment UI

**Files:**
- Modify: `src/components/reservations/ReservationTable.tsx`

- [ ] **Step 1: Read full ReservationTable.tsx**

Read the complete file to understand current structure.

- [ ] **Step 2: Add pending_payment fields to local Reservation type**

```typescript
guest_email: string | null
deposit_expires_at: string | null
```

And update status type:
```typescript
status: 'confirmed' | 'cancelled' | 'completed' | 'no_show' | 'pending_payment'
```

- [ ] **Step 3: Add pending_payment to statusColors and statusLabels**

```typescript
pending_payment: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
// label:
pending_payment: 'Чака капаро',
```

- [ ] **Step 4: Add confirmDeposit function and countdown helper**

```typescript
const confirmDeposit = async (id: string) => {
  const res = await fetch(`/api/reservations/${id}/confirm-deposit`, { method: 'POST' })
  if (res.ok) fetchReservations()
}

function hoursRemaining(expiresAt: string): string {
  const diff = new Date(expiresAt).getTime() - Date.now()
  if (diff <= 0) return 'изтекло'
  const hours = Math.floor(diff / (1000 * 60 * 60))
  return `остават ${hours}ч`
}
```

- [ ] **Step 5: Add confirm button and countdown to pending_payment rows**

Find where the status Badge is rendered. Below it, add:
```tsx
{r.status === 'pending_payment' && (
  <div className="flex flex-col gap-1 mt-1">
    {r.deposit_expires_at && (
      <span className="text-xs text-amber-400">{hoursRemaining(r.deposit_expires_at)}</span>
    )}
    <Button
      size="sm"
      variant="outline"
      className="text-xs h-7 border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
      onClick={() => confirmDeposit(r.id)}
    >
      Потвърди плащане
    </Button>
  </div>
)}
```

- [ ] **Step 6: Run TypeScript check**

```bash
npx tsc --noEmit 2>&1 | head -30
```

- [ ] **Step 7: Commit**

```bash
git add src/components/reservations/ReservationTable.tsx
git commit -m "feat: pending_payment badge, countdown, and confirm button in ReservationTable"
```

---

## Task 10: Pass guest_email + total_amount Through AI Routes

**Files:**
- Modify: `src/app/api/chat/[apiKey]/route.ts`
- Modify: `src/app/api/vapi/[tenantId]/tool-call/route.ts`

This task ensures that when the AI (chat or phone) calls `book_reservation`, it can optionally pass `guest_email` and `total_amount` to trigger the deposit flow.

- [ ] **Step 1: Read both files in full**

Read `src/app/api/chat/[apiKey]/route.ts` and `src/app/api/vapi/[tenantId]/tool-call/route.ts`.

- [ ] **Step 2: Update chat route — pass guest_email and total_amount to booking**

Find the section where the `book_reservation` tool call constructs the request body to `/api/public/book`. Add optional fields:

```typescript
// In the book_reservation tool handler, when constructing the body:
body: JSON.stringify({
  ...existingFields,
  guest_email: toolArgs.guest_email,        // optional
  total_amount: toolArgs.total_amount,       // optional
  room_type_name: toolArgs.room_type_name,   // optional (display name)
})
```

Also update the tool definition (if it's defined in this file) to include these optional parameters in the schema.

- [ ] **Step 3: Update vapi route — same change**

In the vapi tool-call handler for `book_reservation`, add the same optional fields to the fetch body.

- [ ] **Step 4: Run TypeScript check**

```bash
npx tsc --noEmit 2>&1 | head -30
```

- [ ] **Step 5: Commit**

```bash
git add src/app/api/chat/[apiKey]/route.ts src/app/api/vapi/[tenantId]/tool-call/route.ts
git commit -m "feat: pass guest_email + total_amount through AI routes to trigger deposit flow"
```

---

## Final Checklist

- [ ] All 10 tasks committed
- [ ] Migration 006 run in Supabase SQL Editor (verify with column existence check)
- [ ] `CRON_SECRET` added to Vercel environment variables
- [ ] `RESEND_API_KEY` added to Vercel environment variables (emails will silently skip if missing)
- [ ] `npx tsc --noEmit` returns 0 errors
- [ ] Push to deploy: `git push origin master`
- [ ] After deploy: test by making an AI reservation with guest_email + total_amount and confirm proforma email arrives
