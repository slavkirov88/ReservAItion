# ReceptAI Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a multi-tenant AI receptionist SaaS for Bulgarian health clinics with voice (Vapi) and chat capabilities.

**Architecture:** Monolithic Next.js App Router with Supabase multi-tenant PostgreSQL (RLS). Each tenant gets a unique Vapi phone number and embeddable chat widget. AI engine runs in Next.js API routes using GPT-4o-mini.

**Tech Stack:** Next.js 16.1.1, React 19, TypeScript 5, Supabase, TailwindCSS 4, shadcn/ui, Vapi, OpenAI GPT-4o-mini, Stripe, Upstash Redis

---

## Phase 1: Foundation

---

### Task 1: Next.js Project Setup

**Files:**
- Create: `package.json`
- Create: `next.config.ts`
- Create: `tailwind.config.ts`
- Create: `.env.local`
- Create: `.env.example`

**Step 1: Scaffold Next.js project**

```bash
cd C:\Users\mariy\Documents\Projects\ReservAItion
npx create-next-app@latest . --typescript --tailwind --app --src-dir --import-alias "@/*" --no-git
```

**Step 2: Install core dependencies**

```bash
npm install @supabase/supabase-js @supabase/ssr
npm install openai
npm install @vapi-ai/server-sdk
npm install stripe @stripe/stripe-js
npm install @upstash/redis @upstash/ratelimit
npm install resend
npm install date-fns
npm install zod
npm install lucide-react
npm install class-variance-authority clsx tailwind-merge
```

**Step 3: Install shadcn/ui**

```bash
npx shadcn@latest init
# Választ: Dark theme, zinc color, yes to CSS variables
npx shadcn@latest add button input label card dialog form select calendar badge table tabs sheet avatar dropdown-menu toast sonner separator skeleton
```

**Step 4: Create `.env.local`**

```bash
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
OPENAI_API_KEY=your_openai_key
VAPI_API_KEY=your_vapi_key
VAPI_WEBHOOK_SECRET=your_webhook_secret
STRIPE_SECRET_KEY=your_stripe_secret
STRIPE_WEBHOOK_SECRET=your_stripe_webhook_secret
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=your_stripe_pub_key
UPSTASH_REDIS_REST_URL=your_upstash_url
UPSTASH_REDIS_REST_TOKEN=your_upstash_token
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

**Step 5: Create `.env.example`** (copy `.env.local` with empty values)

**Step 6: Commit**

```bash
git add .
git commit -m "feat: initial Next.js project setup with dependencies"
```

---

### Task 2: Supabase Database Schema

**Files:**
- Create: `supabase/migrations/001_initial_schema.sql`
- Create: `supabase/migrations/002_rls_policies.sql`
- Create: `src/lib/supabase/client.ts`
- Create: `src/lib/supabase/server.ts`
- Create: `src/lib/supabase/middleware.ts`
- Create: `src/types/database.ts`

**Step 1: Create migration file `001_initial_schema.sql`**

```sql
-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Tenants (businesses)
create table tenants (
  id uuid primary key default uuid_generate_v4(),
  owner_id uuid references auth.users(id) on delete cascade not null,
  business_name text not null,
  slug text unique not null,
  phone text,
  address text,
  languages text[] default array['bg'],
  public_api_key uuid unique default uuid_generate_v4(),
  vapi_assistant_id text,
  vapi_phone_number text,
  subscription_status text default 'trial' check (subscription_status in ('trial', 'active', 'cancelled', 'past_due')),
  stripe_customer_id text,
  stripe_subscription_id text,
  trial_ends_at timestamptz default now() + interval '14 days',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Business profiles (AI configuration)
create table business_profiles (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid references tenants(id) on delete cascade not null unique,
  services jsonb default '[]'::jsonb,
  faqs jsonb default '[]'::jsonb,
  booking_rules text default '',
  welcome_message_bg text default 'Здравейте! Как мога да ви помогна?',
  welcome_message_en text default 'Hello! How can I help you?',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Schedule rules (working hours per day of week)
create table schedule_rules (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid references tenants(id) on delete cascade not null,
  day_of_week int not null check (day_of_week between 0 and 6),
  start_time time not null,
  end_time time not null,
  slot_duration_min int not null default 30,
  break_start time,
  break_end time,
  is_active boolean default true,
  created_at timestamptz default now(),
  unique(tenant_id, day_of_week)
);

-- Schedule overrides (holidays, special days)
create table schedule_overrides (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid references tenants(id) on delete cascade not null,
  date date not null,
  override_type text not null check (override_type in ('closed', 'custom')),
  slots jsonb default '[]'::jsonb,
  note text,
  created_at timestamptz default now(),
  unique(tenant_id, date)
);

-- Appointments
create table appointments (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid references tenants(id) on delete cascade not null,
  patient_name text not null,
  patient_phone text not null,
  service text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text default 'confirmed' check (status in ('confirmed', 'cancelled', 'no_show', 'completed')),
  channel text not null check (channel in ('phone', 'chat', 'manual')),
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Conversations (call/chat logs)
create table conversations (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid references tenants(id) on delete cascade not null,
  channel text not null check (channel in ('phone', 'chat')),
  language text default 'bg',
  transcript jsonb default '[]'::jsonb,
  appointment_id uuid references appointments(id),
  duration_sec int,
  outcome text check (outcome in ('booked', 'answered', 'failed', 'transferred')),
  created_at timestamptz default now()
);

-- Indexes
create index idx_appointments_tenant_starts on appointments(tenant_id, starts_at);
create index idx_appointments_status on appointments(tenant_id, status);
create index idx_conversations_tenant on conversations(tenant_id, created_at desc);
create index idx_schedule_rules_tenant on schedule_rules(tenant_id);
```

**Step 2: Create RLS policies `002_rls_policies.sql`**

```sql
-- Enable RLS on all tables
alter table tenants enable row level security;
alter table business_profiles enable row level security;
alter table schedule_rules enable row level security;
alter table schedule_overrides enable row level security;
alter table appointments enable row level security;
alter table conversations enable row level security;

-- Tenants: owner only
create policy "tenant_owner_all" on tenants
  for all using (owner_id = auth.uid());

-- Business profiles: via tenant ownership
create policy "business_profile_owner_all" on business_profiles
  for all using (
    tenant_id in (select id from tenants where owner_id = auth.uid())
  );

-- Schedule rules: via tenant ownership
create policy "schedule_rules_owner_all" on schedule_rules
  for all using (
    tenant_id in (select id from tenants where owner_id = auth.uid())
  );

-- Schedule overrides: via tenant ownership
create policy "schedule_overrides_owner_all" on schedule_overrides
  for all using (
    tenant_id in (select id from tenants where owner_id = auth.uid())
  );

-- Appointments: via tenant ownership
create policy "appointments_owner_all" on appointments
  for all using (
    tenant_id in (select id from tenants where owner_id = auth.uid())
  );

-- Conversations: via tenant ownership
create policy "conversations_owner_all" on conversations
  for all using (
    tenant_id in (select id from tenants where owner_id = auth.uid())
  );
```

**Step 3: Create `src/lib/supabase/client.ts`**

```typescript
import { createBrowserClient } from '@supabase/ssr'
import type { Database } from '@/types/database'

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

**Step 4: Create `src/lib/supabase/server.ts`**

```typescript
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { Database } from '@/types/database'

export async function createClient() {
  const cookieStore = await cookies()
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {}
        },
      },
    }
  )
}

export async function createServiceClient() {
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } }
  )
}
```

**Step 5: Create `src/lib/supabase/middleware.ts`**

```typescript
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const isAuthPage = request.nextUrl.pathname.startsWith('/login') ||
                     request.nextUrl.pathname.startsWith('/register')

  if (!user && !isAuthPage && !request.nextUrl.pathname.startsWith('/api/public')) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (user && isAuthPage) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return supabaseResponse
}
```

**Step 6: Create `src/middleware.ts`**

```typescript
import { type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

export async function middleware(request: NextRequest) {
  return await updateSession(request)
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|widget.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
```

**Step 7: Create `src/types/database.ts`** — generate from Supabase CLI or write manually matching schema above (full TypeScript types for all tables).

**Step 8: Run migrations in Supabase dashboard** — copy SQL from migration files and execute.

**Step 9: Commit**

```bash
git add .
git commit -m "feat: database schema, RLS policies, and Supabase client setup"
```

---

### Task 3: Authentication Pages

**Files:**
- Create: `src/app/login/page.tsx`
- Create: `src/app/login/actions.ts`
- Create: `src/app/register/page.tsx`
- Create: `src/app/register/actions.ts`
- Create: `src/app/auth/callback/route.ts`

**Step 1: Create `src/app/auth/callback/route.ts`**

```typescript
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  if (code) {
    const supabase = await createClient()
    await supabase.auth.exchangeCodeForSession(code)
  }

  return NextResponse.redirect(`${origin}/dashboard`)
}
```

**Step 2: Create `src/app/login/actions.ts`**

```typescript
'use server'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export async function login(formData: FormData) {
  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({
    email: formData.get('email') as string,
    password: formData.get('password') as string,
  })
  if (error) return { error: error.message }
  redirect('/dashboard')
}

export async function logout() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}
```

**Step 3: Create login page with shadcn/ui Card + Form components** — email/password fields, submit button, link to register.

**Step 4: Create register page with server action** — calls `supabase.auth.signUp()`.

**Step 5: Test login/register flow manually in browser.**

**Step 6: Commit**

```bash
git commit -m "feat: auth pages — login, register, callback"
```

---

### Task 4: App Layout + Sidebar

**Files:**
- Create: `src/app/(dashboard)/layout.tsx`
- Create: `src/app/(dashboard)/page.tsx` (redirect to /dashboard)
- Create: `src/app/(dashboard)/dashboard/page.tsx`
- Create: `src/components/layout/AppSidebar.tsx`
- Create: `src/components/layout/Header.tsx`
- Create: `src/app/layout.tsx`

**Step 1: Create root `src/app/layout.tsx`** with dark theme class on `<html>`.

**Step 2: Create `src/components/layout/AppSidebar.tsx`**

```typescript
// Sidebar with navigation links using shadcn Sheet for mobile
// Links: Dashboard, Calendar, Appointments, Settings, Subscription
// Shows business name from tenant context
// Highlight active route with usePathname()
```

**Step 3: Create `src/app/(dashboard)/layout.tsx`** — wraps children with sidebar + header, checks auth.

**Step 4: Dashboard page** — placeholder with "Welcome" message for now.

**Step 5: Test navigation renders correctly.**

**Step 6: Commit**

```bash
git commit -m "feat: app layout with sidebar navigation"
```

---

## Phase 2: Onboarding

---

### Task 5: Onboarding Wizard

**Files:**
- Create: `src/app/(dashboard)/onboarding/page.tsx`
- Create: `src/components/onboarding/OnboardingWizard.tsx`
- Create: `src/components/onboarding/steps/Step1BusinessProfile.tsx`
- Create: `src/components/onboarding/steps/Step2Services.tsx`
- Create: `src/components/onboarding/steps/Step3WorkingHours.tsx`
- Create: `src/components/onboarding/steps/Step4FAQ.tsx`
- Create: `src/components/onboarding/steps/Step5Complete.tsx`
- Create: `src/app/api/onboarding/complete/route.ts`

**Step 1: Create wizard state with React `useState`**

```typescript
// OnboardingWizard.tsx
const [step, setStep] = useState(1)
const [data, setData] = useState({
  businessName: '', slug: '', phone: '', address: '',
  services: [], workingHours: [], faqs: []
})
```

**Step 2: Step 1 — Business Profile**
- Fields: business_name, slug (auto-generated from name), phone, address
- Auto-generate slug: `businessName.toLowerCase().replace(/\s+/g, '-')`

**Step 3: Step 2 — Services table**
```typescript
// [{name: string, duration_min: number, price: number}]
// Add/remove rows dynamically
```

**Step 4: Step 3 — Working Hours**
```typescript
// 7 rows (Mon-Sun), each with: is_active toggle, start_time, end_time, slot_duration
// Default: Mon-Fri active, 09:00-18:00, 30 min slots
// Optional break: 13:00-14:00
```

**Step 5: Step 4 — FAQ**
```typescript
// Up to 10 Q&A pairs, add/remove rows
// Placeholder suggestions: "Има ли паркинг?", "Приемате ли НЗОК?"
```

**Step 6: Create `src/app/api/onboarding/complete/route.ts`**

```typescript
// POST - receives all wizard data
// 1. Insert into tenants (with slug uniqueness check)
// 2. Insert into business_profiles
// 3. Insert into schedule_rules (active days only)
// 4. Call Vapi API to create assistant (see Task 12)
// 5. Return {tenantId, vapiPhone, publicApiKey}
// Use service role client (bypasses RLS for initial creation)
```

**Step 7: Step 5 — Complete page** shows:
- Vapi phone number (returned from API)
- Chat widget embed code: `<script src="${APP_URL}/widget.js" data-key="${publicApiKey}"></script>`
- Copy buttons for both

**Step 8: After onboarding completes, redirect to `/dashboard`**

**Step 9: Commit**

```bash
git commit -m "feat: 5-step onboarding wizard"
```

---

## Phase 3: Schedule Management

---

### Task 6: Slot Generation Engine

**Files:**
- Create: `src/lib/scheduling/slot-generator.ts`
- Create: `src/lib/scheduling/slot-generator.test.ts`

**Step 1: Write failing tests**

```typescript
// src/lib/scheduling/slot-generator.test.ts
import { generateSlots } from './slot-generator'

test('generates slots for a standard day', () => {
  const rule = { start_time: '09:00', end_time: '12:00', slot_duration_min: 30 }
  const booked = []
  const slots = generateSlots('2026-03-10', rule, booked)
  expect(slots).toHaveLength(6)
  expect(slots[0]).toBe('09:00')
  expect(slots[5]).toBe('11:30')
})

test('excludes booked slots', () => {
  const rule = { start_time: '09:00', end_time: '10:30', slot_duration_min: 30 }
  const booked = [{ starts_at: '2026-03-10T09:00:00', ends_at: '2026-03-10T09:30:00' }]
  const slots = generateSlots('2026-03-10', rule, booked)
  expect(slots).toHaveLength(2)
  expect(slots).not.toContain('09:00')
})

test('excludes break time', () => {
  const rule = {
    start_time: '09:00', end_time: '15:00',
    slot_duration_min: 60, break_start: '13:00', break_end: '14:00'
  }
  const slots = generateSlots('2026-03-10', rule, [])
  expect(slots).not.toContain('13:00')
  expect(slots).toContain('14:00')
})
```

**Step 2: Run tests — verify they FAIL**

```bash
npm test slot-generator
```

**Step 3: Implement `src/lib/scheduling/slot-generator.ts`**

```typescript
import { addMinutes, format, parse, isWithinInterval } from 'date-fns'

export interface ScheduleRule {
  start_time: string
  end_time: string
  slot_duration_min: number
  break_start?: string | null
  break_end?: string | null
}

export interface BookedSlot {
  starts_at: string
  ends_at: string
}

export function generateSlots(
  date: string,
  rule: ScheduleRule,
  booked: BookedSlot[]
): string[] {
  const slots: string[] = []
  const parseTime = (t: string) => parse(`${date} ${t}`, 'yyyy-MM-dd HH:mm', new Date())

  let current = parseTime(rule.start_time)
  const end = parseTime(rule.end_time)
  const breakStart = rule.break_start ? parseTime(rule.break_start) : null
  const breakEnd = rule.break_end ? parseTime(rule.break_end) : null

  while (current < end) {
    const slotEnd = addMinutes(current, rule.slot_duration_min)
    if (slotEnd > end) break

    // Check break overlap
    const inBreak = breakStart && breakEnd &&
      current >= breakStart && current < breakEnd

    // Check booking overlap
    const isBooked = booked.some(b => {
      const bStart = new Date(b.starts_at)
      const bEnd = new Date(b.ends_at)
      return current < bEnd && slotEnd > bStart
    })

    if (!inBreak && !isBooked) {
      slots.push(format(current, 'HH:mm'))
    }

    current = addMinutes(current, rule.slot_duration_min)
  }

  return slots
}
```

**Step 4: Run tests — verify they PASS**

```bash
npm test slot-generator
```

**Step 5: Commit**

```bash
git commit -m "feat: slot generation engine with tests"
```

---

### Task 7: Schedule Management UI

**Files:**
- Create: `src/app/(dashboard)/settings/schedule/page.tsx`
- Create: `src/components/schedule/WorkingHoursEditor.tsx`
- Create: `src/components/schedule/CalendarOverrides.tsx`
- Create: `src/app/api/schedule/rules/route.ts`
- Create: `src/app/api/schedule/overrides/route.ts`

**Step 1: API route for schedule rules (GET + PUT)**

```typescript
// GET /api/schedule/rules — returns rules for current tenant
// PUT /api/schedule/rules — upserts all 7 days at once
```

**Step 2: Working hours editor component** — table with 7 rows, toggle + time pickers.

**Step 3: Calendar overrides component** — shadcn `Calendar` for date selection, mark as closed or custom hours.

**Step 4: API for overrides (GET + POST + DELETE)**

**Step 5: Test editing working hours saves correctly.**

**Step 6: Commit**

```bash
git commit -m "feat: schedule management UI — working hours and overrides"
```

---

## Phase 4: AI Engine

---

### Task 8: System Prompt Generator

**Files:**
- Create: `src/lib/ai/prompt-generator.ts`
- Create: `src/lib/ai/prompt-generator.test.ts`

**Step 1: Write failing tests**

```typescript
test('generates Bulgarian prompt with services', () => {
  const profile = {
    business_name: 'Дентален Център Иванов',
    address: 'ул. Витоша 15, София',
    services: [{ name: 'Преглед', duration_min: 30, price: 80 }],
    faqs: [{ question: 'Паркинг?', answer: 'Да, пред сградата.' }],
    booking_rules: '',
    welcome_message_bg: 'Здравейте!'
  }
  const prompt = generateSystemPrompt(profile, ['bg', 'en'])
  expect(prompt).toContain('Дентален Център Иванов')
  expect(prompt).toContain('Преглед')
  expect(prompt).toContain('80 лв')
  expect(prompt).toContain('Паркинг?')
})
```

**Step 2: Run — verify FAIL**

**Step 3: Implement `src/lib/ai/prompt-generator.ts`**

```typescript
export function generateSystemPrompt(profile: BusinessProfile, languages: string[]): string {
  const servicesText = profile.services
    .map(s => `- ${s.name}: ${s.duration_min} мин, ${s.price} лв`)
    .join('\n')

  const faqsText = profile.faqs
    .map(f => `В: ${f.question}\nО: ${f.answer}`)
    .join('\n\n')

  const langInstruction = languages.includes('en')
    ? 'Detect the language of the caller and respond in the same language (Bulgarian or English).'
    : 'Говори само на български.'

  return `Ти си AI рецепционист на ${profile.business_name}.
Адрес: ${profile.address}.

УСЛУГИ:
${servicesText}

ЧЗВ:
${faqsText}

${profile.booking_rules ? `СПЕЦИАЛНИ ПРАВИЛА:\n${profile.booking_rules}\n` : ''}

ЗАДАЧИ:
1. Отговаряй на въпроси за работното време, адреса и услугите
2. Записвай часове: питай за услуга → предпочитана дата → час → ime и телефон
3. ${langInstruction}
4. При неясна ситуация предложи да се обади пак в работно време

ВАЖНО: Не измисляй информация. Не давай медицински съвети. Бъди учтив и кратък.`
}
```

**Step 4: Run — verify PASS**

**Step 5: Commit**

```bash
git commit -m "feat: AI system prompt generator with tests"
```

---

### Task 9: Booking API

**Files:**
- Create: `src/app/api/public/slots/route.ts`
- Create: `src/app/api/public/book/route.ts`

**Step 1: Create `GET /api/public/slots`**

```typescript
// Query params: api_key, date, service
// 1. Find tenant by public_api_key
// 2. Get schedule_rule for day_of_week
// 3. Check schedule_overrides for date
// 4. Get existing appointments for date
// 5. Generate slots using slot-generator
// 6. Return {slots: string[], date: string}
// Rate limit: 30 req/min per api_key (Upstash)
```

**Step 2: Create `POST /api/public/book`**

```typescript
// Body: {api_key, patient_name, patient_phone, service, starts_at}
// 1. Find tenant by public_api_key
// 2. Validate slot is still available (re-check)
// 3. INSERT appointment with optimistic check:
//    - Use DB transaction or unique constraint on (tenant_id, starts_at)
// 4. Return {appointment_id, confirmation}
// Rate limit: 10 req/min per api_key
```

**Step 3: Test both endpoints with curl or Postman.**

**Step 4: Commit**

```bash
git commit -m "feat: public slots and booking API endpoints"
```

---

## Phase 5: Vapi Integration

---

### Task 10: Vapi Service

**Files:**
- Create: `src/lib/vapi/vapi-service.ts`
- Create: `src/app/api/vapi/[tenantId]/tool-call/route.ts`

**Step 1: Create `src/lib/vapi/vapi-service.ts`**

```typescript
// Functions:
// createAssistant(tenant, profile) → vapiAssistantId
// createPhoneNumber(assistantId) → phoneNumber
// updateAssistant(assistantId, profile) → void
// deleteAssistant(assistantId) → void

import Vapi from '@vapi-ai/server-sdk'

const vapi = new Vapi({ token: process.env.VAPI_API_KEY! })

export async function createVapiAssistant(
  tenant: Tenant,
  profile: BusinessProfile
): Promise<{ assistantId: string; phoneNumber: string }> {
  const assistant = await vapi.assistants.create({
    name: `ReceptAI - ${tenant.business_name}`,
    voice: {
      provider: 'azure',
      voiceId: 'bg-BG-BorislavNeural', // Bulgarian male voice
    },
    transcriber: {
      provider: 'deepgram',
      language: 'bg',
      model: 'nova-2',
    },
    model: {
      provider: 'openai',
      model: 'gpt-4o-mini',
      messages: [{ role: 'system', content: generateSystemPrompt(profile, tenant.languages) }],
      tools: buildVapiTools(tenant.id),
    },
    firstMessage: profile.welcome_message_bg,
  })

  const phone = await vapi.phoneNumbers.create({
    assistantId: assistant.id,
    // Buy number via Vapi (they manage Twilio)
  })

  return { assistantId: assistant.id, phoneNumber: phone.number }
}

function buildVapiTools(tenantId: string) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL
  return [
    {
      type: 'function',
      function: {
        name: 'get_available_slots',
        description: 'Get available appointment slots for a given date',
        parameters: {
          type: 'object',
          properties: {
            date: { type: 'string', description: 'Date in YYYY-MM-DD format' },
            service: { type: 'string', description: 'Service name' },
          },
          required: ['date'],
        },
      },
      server: { url: `${baseUrl}/api/vapi/${tenantId}/tool-call` },
    },
    {
      type: 'function',
      function: {
        name: 'book_appointment',
        description: 'Book an appointment slot',
        parameters: {
          type: 'object',
          properties: {
            patient_name: { type: 'string' },
            patient_phone: { type: 'string' },
            service: { type: 'string' },
            starts_at: { type: 'string', description: 'ISO datetime' },
          },
          required: ['patient_name', 'patient_phone', 'service', 'starts_at'],
        },
      },
      server: { url: `${baseUrl}/api/vapi/${tenantId}/tool-call` },
    },
    {
      type: 'function',
      function: {
        name: 'get_business_info',
        description: 'Get business information like address, hours, services',
        parameters: {
          type: 'object',
          properties: {
            query: { type: 'string' },
          },
          required: ['query'],
        },
      },
      server: { url: `${baseUrl}/api/vapi/${tenantId}/tool-call` },
    },
  ]
}
```

**Step 2: Create Vapi webhook handler `src/app/api/vapi/[tenantId]/tool-call/route.ts`**

```typescript
import { createServiceClient } from '@/lib/supabase/server'
import { generateSlots } from '@/lib/scheduling/slot-generator'
import { NextResponse } from 'next/server'
import crypto from 'crypto'

export async function POST(
  request: Request,
  { params }: { params: { tenantId: string } }
) {
  // Validate HMAC signature from Vapi
  const signature = request.headers.get('x-vapi-signature')
  const body = await request.text()
  const expected = crypto
    .createHmac('sha256', process.env.VAPI_WEBHOOK_SECRET!)
    .update(body)
    .digest('hex')
  if (signature !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const payload = JSON.parse(body)
  const { toolName, parameters } = payload

  const supabase = createServiceClient()
  const tenantId = params.tenantId

  if (toolName === 'get_available_slots') {
    // Use slot-generator, return slots array
  }

  if (toolName === 'book_appointment') {
    // Insert appointment, return confirmation
  }

  if (toolName === 'get_business_info') {
    // Return business profile info
  }

  return NextResponse.json({ result: 'Unknown tool' })
}
```

**Step 3: Test by calling a Vapi test call (use Vapi dashboard test feature).**

**Step 4: Commit**

```bash
git commit -m "feat: Vapi assistant creation and tool-call webhook handler"
```

---

## Phase 6: Chat Widget

---

### Task 11: Chat API (SSE)

**Files:**
- Create: `src/app/api/chat/[apiKey]/route.ts`

**Step 1: Implement streaming chat endpoint**

```typescript
// POST /api/chat/[apiKey]
// Body: {message: string, sessionId: string, history: Message[]}
// 1. Find tenant by public_api_key
// 2. Check rate limit (Upstash: 20 msg/min per sessionId)
// 3. Build messages: system prompt + history + user message
// 4. Stream OpenAI response using SSE
// 5. On finish: detect if appointment was booked, save conversation
// Returns: text/event-stream

import OpenAI from 'openai'

const openai = new OpenAI()

export async function POST(req: Request, { params }) {
  const { message, history, sessionId } = await req.json()

  // Get tenant profile
  // Build system prompt with slot-checking tools

  const stream = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [...history, { role: 'user', content: message }],
    stream: true,
    tools: chatTools, // same as Vapi but calling internal functions
  })

  return new Response(
    new ReadableStream({
      async start(controller) {
        for await (const chunk of stream) {
          const text = chunk.choices[0]?.delta?.content || ''
          controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ text })}\n\n`))
        }
        controller.enqueue(new TextEncoder().encode('data: [DONE]\n\n'))
        controller.close()
      }
    }),
    { headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' } }
  )
}
```

**Step 2: Test streaming with curl**

```bash
curl -X POST http://localhost:3000/api/chat/YOUR_API_KEY \
  -H "Content-Type: application/json" \
  -d '{"message":"Здравейте","history":[],"sessionId":"test-123"}'
```

**Step 3: Commit**

```bash
git commit -m "feat: streaming chat API with SSE"
```

---

### Task 12: Embeddable Chat Widget

**Files:**
- Create: `public/widget.js`
- Create: `src/app/api/widget/[apiKey]/config/route.ts`

**Step 1: Create `src/app/api/widget/[apiKey]/config/route.ts`**

```typescript
// GET — returns {businessName, welcomeMessage, language}
// Public endpoint, no auth required
// Cache-Control: public, max-age=300
```

**Step 2: Create `public/widget.js`** — vanilla JS, no framework dependencies

```javascript
(function() {
  const script = document.currentScript
  const apiKey = script.getAttribute('data-key')
  const appUrl = 'https://receptai.bg' // injected at build time

  // 1. Fetch config (business name, welcome message)
  // 2. Inject chat button (fixed bottom-right, brand colors)
  // 3. On click: open chat panel (iframe or inline div)
  // 4. Handle message streaming via EventSource
  // 5. Store sessionId in sessionStorage
  // Widget is ~150 lines of vanilla JS, no external deps
})()
```

**Step 3: Create widget preview page in dashboard**

```
/settings/widget — shows preview + embed code
```

**Step 4: Test widget by including in a plain HTML file.**

**Step 5: Commit**

```bash
git commit -m "feat: embeddable chat widget (vanilla JS)"
```

---

## Phase 7: Dashboard

---

### Task 13: Appointments Page

**Files:**
- Create: `src/app/(dashboard)/appointments/page.tsx`
- Create: `src/app/api/appointments/route.ts`
- Create: `src/components/appointments/AppointmentTable.tsx`
- Create: `src/components/appointments/AppointmentStatusBadge.tsx`

**Step 1: API `GET /api/appointments`** — paginated list, filterable by date range and status.

**Step 2: `AppointmentTable`** — shadcn Table with columns: date/time, patient name, service, channel, status badge, actions (cancel, mark no-show).

**Step 3: `PATCH /api/appointments/[id]`** — update status.

**Step 4: Commit**

```bash
git commit -m "feat: appointments management page"
```

---

### Task 14: Visual Calendar

**Files:**
- Create: `src/app/(dashboard)/calendar/page.tsx`
- Create: `src/components/calendar/WeekView.tsx`

**Step 1: Week view calendar** showing appointments as blocks, time slots visible, click slot to add manual appointment.

**Step 2: Color code by status**: confirmed (blue), cancelled (red), completed (green).

**Step 3: "Block day" button** — creates schedule_override type 'closed'.

**Step 4: Commit**

```bash
git commit -m "feat: visual calendar with week view"
```

---

### Task 15: Analytics Dashboard

**Files:**
- Create: `src/app/(dashboard)/dashboard/page.tsx` (replace placeholder)
- Create: `src/app/api/analytics/route.ts`
- Create: `src/components/analytics/StatsCards.tsx`
- Create: `src/components/analytics/CallsByHourChart.tsx`

**Step 1: API `GET /api/analytics`** — returns aggregated stats for current week

```typescript
// Returns:
// - total_calls: count of conversations (phone) this week
// - total_booked: count of appointments this week
// - avg_duration_sec: average call duration
// - success_rate: booked / total_calls * 100
// - calls_by_hour: [{hour: 9, count: 5}, ...]
// - recent_conversations: last 10 with transcript preview
```

**Step 2: Stats cards grid** — 4 cards as designed.

**Step 3: Bar chart for calls by hour** — use a simple CSS-based chart or recharts.

**Step 4: Recent conversations table** with expandable transcript.

**Step 5: Commit**

```bash
git commit -m "feat: analytics dashboard with stats and charts"
```

---

## Phase 8: Stripe Subscription

---

### Task 16: Stripe Integration

**Files:**
- Create: `src/lib/stripe/stripe.ts`
- Create: `src/app/api/stripe/checkout/route.ts`
- Create: `src/app/api/stripe/webhook/route.ts`
- Create: `src/app/(dashboard)/subscription/page.tsx`

**Step 1: Create `src/lib/stripe/stripe.ts`**

```typescript
import Stripe from 'stripe'
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-12-18.acacia',
})

export const PLANS = {
  starter: { priceId: 'price_xxx', name: 'Стартов', price: 149 },
  pro: { priceId: 'price_xxx', name: 'Pro', price: 299 },
}
```

**Step 2: Checkout endpoint `POST /api/stripe/checkout`**

```typescript
// Creates Stripe Checkout session
// success_url: /dashboard?subscribed=true
// cancel_url: /subscription
// Attach tenantId in metadata
```

**Step 3: Webhook handler `POST /api/stripe/webhook`**

```typescript
// Verify stripe webhook signature
// Handle events:
// - checkout.session.completed → update tenant subscription_status to 'active'
// - customer.subscription.deleted → status to 'cancelled'
// - invoice.payment_failed → status to 'past_due'
// Use raw body (disable Next.js body parsing)
```

**Step 4: Subscription page** — shows current plan, upgrade button, trial countdown.

**Step 5: Middleware check** — if subscription_status is 'cancelled' or trial expired, redirect to /subscription.

**Step 6: Commit**

```bash
git commit -m "feat: Stripe subscription with webhook handler"
```

---

## Phase 9: Security & Polish

---

### Task 17: Rate Limiting

**Files:**
- Create: `src/lib/rate-limit.ts`

**Step 1: Create rate limiter utility**

```typescript
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

const redis = Redis.fromEnv()

export const chatRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(20, '1 m'),
  prefix: 'chat',
})

export const slotsRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(30, '1 m'),
  prefix: 'slots',
})

export async function checkRateLimit(limiter: Ratelimit, identifier: string) {
  const { success, limit, remaining } = await limiter.limit(identifier)
  if (!success) {
    throw new Response('Too Many Requests', {
      status: 429,
      headers: { 'X-RateLimit-Limit': String(limit), 'X-RateLimit-Remaining': String(remaining) },
    })
  }
}
```

**Step 2: Apply to `/api/public/slots`, `/api/public/book`, `/api/chat/[apiKey]`**

**Step 3: Commit**

```bash
git commit -m "feat: rate limiting with Upstash Redis"
```

---

### Task 18: Settings Pages

**Files:**
- Create: `src/app/(dashboard)/settings/profile/page.tsx`
- Create: `src/app/(dashboard)/settings/services/page.tsx`
- Create: `src/app/(dashboard)/settings/ai/page.tsx`
- Create: `src/app/(dashboard)/settings/widget/page.tsx`

**Step 1: Profile settings** — edit business name, address, phone.

**Step 2: Services editor** — same as onboarding Step 2 but as standalone page.

**Step 3: AI configuration page** — edit welcome messages (BG/EN), custom booking rules, FAQ.

**Step 4: Widget page** — preview + embed code + instructions.

**Step 5: When profile/services/AI settings change, update Vapi assistant via `vapi-service.updateAssistant()`**

**Step 6: Commit**

```bash
git commit -m "feat: settings pages for profile, services, and AI config"
```

---

## Phase 10: Deployment

---

### Task 19: Deploy to Vercel

**Files:**
- Create: `vercel.json`

**Step 1: Create `vercel.json`**

```json
{
  "functions": {
    "src/app/api/vapi/**": { "maxDuration": 30 },
    "src/app/api/stripe/webhook": { "maxDuration": 10 }
  }
}
```

**Step 2: Push to GitHub**

```bash
git remote add origin YOUR_GITHUB_REPO
git push -u origin main
```

**Step 3: Connect to Vercel, add all environment variables.**

**Step 4: Set up production Supabase project, run migrations.**

**Step 5: Configure Vapi webhook URLs to production domain.**

**Step 6: Configure Stripe webhook endpoint to production domain.**

**Step 7: Test full flow in production:**
- Register new business
- Complete onboarding
- Make test call to Vapi number
- Send chat message via widget
- Check appointment appears in dashboard

**Step 8: Commit**

```bash
git commit -m "chore: Vercel deployment configuration"
```

---

## Summary

| Phase | Tasks | Key Deliverable |
|-------|-------|-----------------|
| 1 Foundation | 1-4 | Working auth + layout |
| 2 Onboarding | 5 | 5-step wizard |
| 3 Scheduling | 6-7 | Slot engine + UI |
| 4 AI Engine | 8-9 | Booking API |
| 5 Vapi | 10 | Phone calls work |
| 6 Chat | 11-12 | Widget embeds on client site |
| 7 Dashboard | 13-15 | Full management UI |
| 8 Stripe | 16 | Subscription billing |
| 9 Security | 17-18 | Rate limits + settings |
| 10 Deploy | 19 | Production live |

**Recommended execution order:** Tasks 1 → 2 → 3 → 4 → 6 → 9 → 8 → 10 → 11 → 12 → 5 → 7 → 13 → 14 → 15 → 16 → 17 → 18 → 19
