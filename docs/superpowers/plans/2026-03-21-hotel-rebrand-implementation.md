# Hotel Rebrand Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebrand ReservAItion from a dental clinic appointment app to a hotel AI receptionist — renaming the DB table, updating all TypeScript types, replacing all UI text, adding new Rooms and Today pages, and updating the AI prompt.

**Architecture:** DB migration first (Supabase dashboard), then TypeScript types, then API routes, then UI components. New pages (Rooms, Today) are added after core rebrand is complete. All changes are backward-compatible within the session — the old `/appointments` and `/calendar` routes are redirected at the end.

**Tech Stack:** Next.js 16 (App Router), Supabase, TypeScript, Tailwind CSS, shadcn/ui, lucide-react

---

## File Map

### Modified
- `src/types/database.ts` — add RoomType, Room, Reservation types; rename Appointment → Reservation
- `src/components/layout/AppSidebar.tsx` — new nav items
- `src/components/analytics/StatsCards.tsx` — hotel KPI cards
- `src/app/(dashboard)/dashboard/page.tsx` — hotel dashboard data
- `src/app/api/appointments/route.ts` → move to `src/app/api/reservations/route.ts`
- `src/app/api/appointments/[id]/route.ts` → move to `src/app/api/reservations/[id]/route.ts`
- `src/app/api/chat/[apiKey]/route.ts` — rename fields, update tool definitions
- `src/app/api/vapi/[tenantId]/tool-call/route.ts` — rename fields, update messages
- `src/lib/ai/prompt-generator.ts` — hotel prompt
- `src/components/appointments/AppointmentTable.tsx` — rename fields (guest_name, guest_phone)
- `src/app/(dashboard)/appointments/page.tsx` — redirect to /reservations
- `src/app/(dashboard)/calendar/page.tsx` — redirect to /today
- `src/components/settings/ProfileEditor.tsx` — "хотел" instead of "клиника"
- `src/components/onboarding/steps/Step1BusinessProfile.tsx` — placeholder text
- `src/app/api/analytics/route.ts` — update table name

### Created
- `src/app/api/reservations/route.ts` — GET reservations list
- `src/app/api/reservations/[id]/route.ts` — PATCH reservation status
- `src/app/api/rooms/route.ts` — GET/POST room_types and rooms
- `src/app/api/rooms/[id]/route.ts` — PATCH room status
- `src/app/(dashboard)/reservations/page.tsx` — reservations list page
- `src/app/(dashboard)/today/page.tsx` — check-ins & check-outs today
- `src/app/(dashboard)/rooms/page.tsx` — rooms management page
- `src/components/rooms/RoomTypesTab.tsx` — room types CRUD UI
- `src/components/rooms/RoomsTab.tsx` — rooms list + status UI
- `src/components/rooms/AddRoomTypeDialog.tsx` — add room type modal
- `src/components/rooms/AddRoomDialog.tsx` — add room modal
- `src/components/reservations/ReservationTable.tsx` — reservations table (adapted from AppointmentTable)

---

## Task 1: Database Migration (Supabase)

**Files:** Run SQL in Supabase Dashboard → SQL Editor

> ⚠️ This is NOT a code change. Open Supabase Dashboard → SQL Editor and run the following SQL in order.

- [ ] **Step 1: Create room_types table**

```sql
CREATE TABLE room_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  capacity int NOT NULL DEFAULT 2,
  price_per_night numeric(10,2) NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE room_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_own_room_types" ON room_types
  USING (tenant_id IN (SELECT id FROM tenants WHERE owner_id = auth.uid()));
```

- [ ] **Step 2: Create rooms table**

```sql
CREATE TABLE rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  room_type_id uuid NOT NULL REFERENCES room_types(id) ON DELETE CASCADE,
  room_number text,
  name text,
  status text NOT NULL DEFAULT 'free'
    CHECK (status IN ('free', 'occupied', 'cleaning', 'maintenance')),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_own_rooms" ON rooms
  USING (tenant_id IN (SELECT id FROM tenants WHERE owner_id = auth.uid()));
```

- [ ] **Step 3: Rename appointments table and columns**

```sql
ALTER TABLE appointments RENAME TO reservations;
ALTER TABLE reservations RENAME COLUMN patient_name TO guest_name;
ALTER TABLE reservations RENAME COLUMN patient_phone TO guest_phone;
ALTER TABLE reservations RENAME COLUMN starts_at TO check_in_date;
ALTER TABLE reservations RENAME COLUMN ends_at TO check_out_date;
ALTER TABLE reservations ADD COLUMN room_type_id uuid REFERENCES room_types(id);
ALTER TABLE reservations ADD COLUMN room_id uuid REFERENCES rooms(id);
```

- [ ] **Step 4: Update conversations FK reference**

```sql
-- conversations.appointment_id still points to the renamed table (Postgres tracks it automatically)
-- But rename the column for clarity:
ALTER TABLE conversations RENAME COLUMN appointment_id TO reservation_id;
```

- [ ] **Step 5: Verify tables exist**

Run: `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;`

Expected: see `reservations`, `room_types`, `rooms` in the list.

---

## Task 2: TypeScript Types

**Files:**
- Modify: `src/types/database.ts`

- [ ] **Step 1: Replace the entire file content**

```typescript
// JSONB field types
export type FAQ = {
  question: string
  answer: string
}

export type TranscriptEntry = {
  role: 'user' | 'assistant'
  content: string
  timestamp?: string
}

export type SlotOverride = {
  start_time: string
  end_time: string
}

// Row types (what comes back from the database)
export type TenantRow = {
  id: string
  owner_id: string
  business_name: string
  slug: string
  phone: string | null
  address: string | null
  languages: string[]
  public_api_key: string
  vapi_assistant_id: string | null
  vapi_phone_number: string | null
  subscription_status: 'trial' | 'active' | 'cancelled' | 'past_due'
  stripe_customer_id: string | null
  stripe_subscription_id: string | null
  trial_ends_at: string
  created_at: string
  updated_at: string
}

export type BusinessProfileRow = {
  id: string
  tenant_id: string
  faqs: FAQ[]
  booking_rules: string
  welcome_message_bg: string
  welcome_message_en: string
  created_at: string
  updated_at: string
}

export type ScheduleRuleRow = {
  id: string
  tenant_id: string
  day_of_week: number
  start_time: string
  end_time: string
  slot_duration_min: number
  break_start: string | null
  break_end: string | null
  is_active: boolean
  created_at: string
}

export type ScheduleOverrideRow = {
  id: string
  tenant_id: string
  date: string
  override_type: 'closed' | 'custom'
  slots: SlotOverride[]
  note: string | null
  created_at: string
}

export type RoomTypeRow = {
  id: string
  tenant_id: string
  name: string
  description: string | null
  capacity: number
  price_per_night: number
  created_at: string
}

export type RoomRow = {
  id: string
  tenant_id: string
  room_type_id: string
  room_number: string | null
  name: string | null
  status: 'free' | 'occupied' | 'cleaning' | 'maintenance'
  created_at: string
}

export type ReservationRow = {
  id: string
  tenant_id: string
  guest_name: string
  guest_phone: string
  room_type_id: string | null
  room_id: string | null
  check_in_date: string
  check_out_date: string | null
  status: 'confirmed' | 'cancelled' | 'no_show' | 'completed'
  channel: 'phone' | 'chat' | 'manual'
  notes: string | null
  created_at: string
  updated_at: string
}

export type ConversationRow = {
  id: string
  tenant_id: string
  channel: 'phone' | 'chat'
  language: string
  transcript: TranscriptEntry[]
  reservation_id: string | null
  duration_sec: number | null
  outcome: 'booked' | 'answered' | 'failed' | 'transferred' | null
  created_at: string
}

// Insert types
export type TenantInsert = {
  id?: string
  owner_id: string
  business_name: string
  slug: string
  phone?: string | null
  address?: string | null
  languages?: string[]
  public_api_key?: string
  vapi_assistant_id?: string | null
  vapi_phone_number?: string | null
  subscription_status?: 'trial' | 'active' | 'cancelled' | 'past_due'
  stripe_customer_id?: string | null
  stripe_subscription_id?: string | null
  trial_ends_at?: string
  created_at?: string
  updated_at?: string
}

export type BusinessProfileInsert = {
  id?: string
  tenant_id: string
  faqs?: FAQ[]
  booking_rules?: string
  welcome_message_bg?: string
  welcome_message_en?: string
  created_at?: string
  updated_at?: string
}

export type ScheduleRuleInsert = {
  id?: string
  tenant_id: string
  day_of_week: number
  start_time: string
  end_time: string
  slot_duration_min?: number
  break_start?: string | null
  break_end?: string | null
  is_active?: boolean
  created_at?: string
}

export type ScheduleOverrideInsert = {
  id?: string
  tenant_id: string
  date: string
  override_type: 'closed' | 'custom'
  slots?: SlotOverride[]
  note?: string | null
  created_at?: string
}

export type RoomTypeInsert = {
  id?: string
  tenant_id: string
  name: string
  description?: string | null
  capacity?: number
  price_per_night: number
  created_at?: string
}

export type RoomInsert = {
  id?: string
  tenant_id: string
  room_type_id: string
  room_number?: string | null
  name?: string | null
  status?: 'free' | 'occupied' | 'cleaning' | 'maintenance'
  created_at?: string
}

export type ReservationInsert = {
  id?: string
  tenant_id: string
  guest_name: string
  guest_phone: string
  room_type_id?: string | null
  room_id?: string | null
  check_in_date: string
  check_out_date?: string | null
  status?: 'confirmed' | 'cancelled' | 'no_show' | 'completed'
  channel: 'phone' | 'chat' | 'manual'
  notes?: string | null
  created_at?: string
  updated_at?: string
}

export type ConversationInsert = {
  id?: string
  tenant_id: string
  channel: 'phone' | 'chat'
  language?: string
  transcript?: TranscriptEntry[]
  reservation_id?: string | null
  duration_sec?: number | null
  outcome?: 'booked' | 'answered' | 'failed' | 'transferred' | null
  created_at?: string
}

// Update types
export type TenantUpdate = Partial<Omit<TenantInsert, 'id'>>
export type BusinessProfileUpdate = Partial<Omit<BusinessProfileInsert, 'id'>>
export type ScheduleRuleUpdate = Partial<Omit<ScheduleRuleInsert, 'id'>>
export type ScheduleOverrideUpdate = Partial<Omit<ScheduleOverrideInsert, 'id'>>
export type RoomTypeUpdate = Partial<Omit<RoomTypeInsert, 'id'>>
export type RoomUpdate = Partial<Omit<RoomInsert, 'id'>>
export type ReservationUpdate = Partial<Omit<ReservationInsert, 'id'>>
export type ConversationUpdate = Partial<Omit<ConversationInsert, 'id'>>

// Aliases
export type Tenant = TenantRow
export type BusinessProfile = BusinessProfileRow
export type ScheduleRule = ScheduleRuleRow
export type ScheduleOverride = ScheduleOverrideRow
export type RoomType = RoomTypeRow
export type Room = RoomRow
export type Reservation = ReservationRow
export type Conversation = ConversationRow

// Supabase Database type
export type Database = {
  public: {
    Tables: {
      tenants: { Row: TenantRow; Insert: TenantInsert; Update: TenantUpdate; Relationships: [] }
      business_profiles: { Row: BusinessProfileRow; Insert: BusinessProfileInsert; Update: BusinessProfileUpdate; Relationships: [] }
      schedule_rules: { Row: ScheduleRuleRow; Insert: ScheduleRuleInsert; Update: ScheduleRuleUpdate; Relationships: [] }
      schedule_overrides: { Row: ScheduleOverrideRow; Insert: ScheduleOverrideInsert; Update: ScheduleOverrideUpdate; Relationships: [] }
      room_types: { Row: RoomTypeRow; Insert: RoomTypeInsert; Update: RoomTypeUpdate; Relationships: [] }
      rooms: { Row: RoomRow; Insert: RoomInsert; Update: RoomUpdate; Relationships: [] }
      reservations: { Row: ReservationRow; Insert: ReservationInsert; Update: ReservationUpdate; Relationships: [] }
      conversations: { Row: ConversationRow; Insert: ConversationInsert; Update: ConversationUpdate; Relationships: [] }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/types/database.ts
git commit -m "refactor: rename Appointment→Reservation types, add RoomType and Room"
```

---

## Task 3: Sidebar Navigation

**Files:**
- Modify: `src/components/layout/AppSidebar.tsx`

- [ ] **Step 1: Replace navItems and imports**

Replace the entire file:

```typescript
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  Sun,
  CalendarDays,
  BedDouble,
  Settings,
  CreditCard,
  Bot,
  Menu,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/today', label: 'Днес', icon: Sun },
  { href: '/reservations', label: 'Резервации', icon: CalendarDays },
  { href: '/rooms', label: 'Стаи', icon: BedDouble },
  { href: '/settings/profile', label: 'Настройки', icon: Settings },
  { href: '/subscription', label: 'Абонамент', icon: CreditCard },
]

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname()
  return (
    <nav className="flex flex-col gap-1 p-4">
      {navItems.map(({ href, label, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          onClick={onNavigate}
          className={cn(
            'flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors',
            pathname === href || pathname.startsWith(href + '/')
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:text-foreground hover:bg-accent'
          )}
        >
          <Icon className="h-4 w-4" />
          {label}
        </Link>
      ))}
    </nav>
  )
}

function SidebarContent() {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 px-6 py-5 border-b border-border">
        <Bot className="h-6 w-6 text-primary" />
        <span className="font-semibold text-lg">ReservAItion</span>
      </div>
      <NavLinks />
    </div>
  )
}

export function AppSidebar() {
  return (
    <>
      <aside className="hidden md:flex w-64 flex-col border-r border-border bg-card h-screen sticky top-0">
        <SidebarContent />
      </aside>
      <Sheet>
        <SheetTrigger
          render={<Button variant="ghost" size="icon" className="md:hidden" />}
        >
          <Menu className="h-5 w-5" />
        </SheetTrigger>
        <SheetContent side="left" className="w-64 p-0">
          <SidebarContent />
        </SheetContent>
      </Sheet>
    </>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/layout/AppSidebar.tsx
git commit -m "feat: update sidebar navigation for hotel — add Днес, Резервации, Стаи"
```

---

## Task 4: Dashboard Page + StatsCards

**Files:**
- Modify: `src/components/analytics/StatsCards.tsx`
- Modify: `src/app/(dashboard)/dashboard/page.tsx`

- [ ] **Step 1: Replace StatsCards**

```typescript
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { BedDouble, LogIn, LogOut, Phone } from 'lucide-react'

interface Stats {
  occupancy_percent: number
  checkins_today: number
  checkouts_today: number
  total_calls_week: number
}

export function StatsCards({ stats }: { stats: Stats }) {
  const cards = [
    {
      title: 'Заетост',
      value: `${stats.occupancy_percent}%`,
      icon: BedDouble,
      description: 'от стаите са заети',
      className: 'text-primary',
    },
    {
      title: 'Check-ins днес',
      value: stats.checkins_today,
      icon: LogIn,
      description: 'пристигащи',
      className: 'text-green-400',
    },
    {
      title: 'Check-outs днес',
      value: stats.checkouts_today,
      icon: LogOut,
      description: 'напускащи',
      className: 'text-blue-400',
    },
    {
      title: 'AI обаждания',
      value: stats.total_calls_week,
      icon: Phone,
      description: 'тази седмица',
      className: 'text-purple-400',
    },
  ]

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map(card => (
        <Card key={card.title} className="border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{card.title}</CardTitle>
            <card.icon className={`h-4 w-4 ${card.className}`} />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{card.value}</div>
            <p className="text-xs text-muted-foreground mt-1">{card.description}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Replace dashboard page**

```typescript
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek } from 'date-fns'
import { bg } from 'date-fns/locale'
import { StatsCards } from '@/components/analytics/StatsCards'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { ReservationRow, ConversationRow, RoomRow } from '@/types/database'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: tenant } = await supabase
    .from('tenants')
    .select('id, business_name')
    .eq('owner_id', user.id)
    .single()

  if (!tenant) redirect('/onboarding')

  const now = new Date()
  const todayStart = format(startOfDay(now), "yyyy-MM-dd'T'HH:mm:ss")
  const todayEnd = format(endOfDay(now), "yyyy-MM-dd'T'HH:mm:ss")
  const weekStart = format(startOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd')
  const weekEnd = format(endOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd')

  const [
    { data: reservationsData },
    { data: conversationsData },
    { data: roomsData },
  ] = await Promise.all([
    supabase
      .from('reservations')
      .select('*')
      .eq('tenant_id', tenant.id)
      .order('check_in_date', { ascending: false })
      .limit(5),
    supabase
      .from('conversations')
      .select('*')
      .eq('tenant_id', tenant.id)
      .gte('created_at', `${weekStart}T00:00:00`)
      .lte('created_at', `${weekEnd}T23:59:59`),
    supabase
      .from('rooms')
      .select('*')
      .eq('tenant_id', tenant.id),
  ])

  const reservations = (reservationsData || []) as ReservationRow[]
  const convs = (conversationsData || []) as ConversationRow[]
  const rooms = (roomsData || []) as RoomRow[]

  const occupiedRooms = rooms.filter(r => r.status === 'occupied').length
  const occupancyPercent = rooms.length > 0 ? Math.round((occupiedRooms / rooms.length) * 100) : 0

  const checkinsToday = reservations.filter(r =>
    r.check_in_date >= todayStart && r.check_in_date <= todayEnd
  ).length

  const checkoutsToday = reservations.filter(r =>
    r.check_out_date && r.check_out_date >= todayStart && r.check_out_date <= todayEnd
  ).length

  const stats = {
    occupancy_percent: occupancyPercent,
    checkins_today: checkinsToday,
    checkouts_today: checkoutsToday,
    total_calls_week: convs.filter(c => c.channel === 'phone').length,
  }

  const statusColors: Record<string, string> = {
    confirmed: 'bg-green-500/10 text-green-400 border-green-500/30',
    cancelled: 'bg-red-500/10 text-red-400 border-red-500/30',
    completed: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
    no_show: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30',
  }

  const statusLabels: Record<string, string> = {
    confirmed: 'Потвърдена',
    cancelled: 'Отменена',
    completed: 'Завършена',
    no_show: 'Неявил се',
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">{tenant.business_name} — {format(now, 'dd MMMM yyyy', { locale: bg })}</p>
      </div>

      <StatsCards stats={stats} />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Последни резервации</CardTitle>
        </CardHeader>
        <CardContent>
          {reservations.length === 0 ? (
            <p className="text-muted-foreground text-sm">Няма резервации</p>
          ) : (
            <div className="space-y-3">
              {reservations.map(r => (
                <div key={r.id} className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">{r.guest_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(r.check_in_date), 'dd MMM yyyy', { locale: bg })}
                      {r.check_out_date && ` – ${format(new Date(r.check_out_date), 'dd MMM yyyy', { locale: bg })}`}
                    </p>
                  </div>
                  <Badge variant="outline" className={statusColors[r.status]}>
                    {statusLabels[r.status] || r.status}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/analytics/StatsCards.tsx src/app/(dashboard)/dashboard/page.tsx
git commit -m "feat: hotel dashboard — occupancy, check-ins, check-outs KPIs"
```

---

## Task 5: Reservations API Routes

**Files:**
- Create: `src/app/api/reservations/route.ts`
- Create: `src/app/api/reservations/[id]/route.ts`

- [ ] **Step 1: Create `src/app/api/reservations/route.ts`**

```typescript
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: tenant } = await supabase.from('tenants').select('id').eq('owner_id', user.id).single()
  if (!tenant) return NextResponse.json({ error: 'No tenant' }, { status: 404 })

  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status')
  const from = searchParams.get('from')
  const to = searchParams.get('to')
  const page = parseInt(searchParams.get('page') || '1')
  const pageSize = 20

  let query = supabase
    .from('reservations')
    .select('*', { count: 'exact' })
    .eq('tenant_id', tenant.id)
    .order('check_in_date', { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1)

  if (status) query = query.eq('status', status as 'confirmed' | 'cancelled' | 'no_show' | 'completed')
  if (from) query = query.gte('check_in_date', from)
  if (to) query = query.lte('check_in_date', to)

  const { data, count, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ reservations: data, total: count, page, pageSize })
}
```

- [ ] **Step 2: Create `src/app/api/reservations/[id]/route.ts`**

```typescript
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: tenant } = await supabase.from('tenants').select('id').eq('owner_id', user.id).single()
  if (!tenant) return NextResponse.json({ error: 'No tenant' }, { status: 404 })

  const { status, room_id } = await request.json()

  const update: Record<string, string> = { updated_at: new Date().toISOString() }
  if (status) update.status = status
  if (room_id !== undefined) update.room_id = room_id

  const { error } = await supabase
    .from('reservations')
    .update(update)
    .eq('id', id)
    .eq('tenant_id', tenant.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/reservations/
git commit -m "feat: add /api/reservations GET and PATCH routes"
```

---

## Task 6: Rooms API Routes

**Files:**
- Create: `src/app/api/rooms/route.ts`
- Create: `src/app/api/rooms/[id]/route.ts`

- [ ] **Step 1: Create `src/app/api/rooms/route.ts`**

```typescript
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: tenant } = await supabase.from('tenants').select('id').eq('owner_id', user.id).single()
  if (!tenant) return NextResponse.json({ error: 'No tenant' }, { status: 404 })

  const [{ data: roomTypes }, { data: rooms }] = await Promise.all([
    supabase.from('room_types').select('*').eq('tenant_id', tenant.id).order('created_at'),
    supabase.from('rooms').select('*').eq('tenant_id', tenant.id).order('room_number'),
  ])

  return NextResponse.json({ roomTypes: roomTypes || [], rooms: rooms || [] })
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: tenant } = await supabase.from('tenants').select('id').eq('owner_id', user.id).single()
  if (!tenant) return NextResponse.json({ error: 'No tenant' }, { status: 404 })

  const body = await request.json()
  const { type, ...fields } = body // type: 'room_type' | 'room'

  if (type === 'room_type') {
    const { data, error } = await supabase
      .from('room_types')
      .insert({ ...fields, tenant_id: tenant.id })
      .select()
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ roomType: data })
  }

  if (type === 'room') {
    const { data, error } = await supabase
      .from('rooms')
      .insert({ ...fields, tenant_id: tenant.id })
      .select()
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ room: data })
  }

  return NextResponse.json({ error: 'Invalid type' }, { status: 400 })
}
```

- [ ] **Step 2: Create `src/app/api/rooms/[id]/route.ts`**

```typescript
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: tenant } = await supabase.from('tenants').select('id').eq('owner_id', user.id).single()
  if (!tenant) return NextResponse.json({ error: 'No tenant' }, { status: 404 })

  const { table, ...fields } = await request.json() // table: 'rooms' | 'room_types'
  const tableName = table === 'room_types' ? 'room_types' : 'rooms'

  const { error } = await supabase
    .from(tableName)
    .update(fields)
    .eq('id', id)
    .eq('tenant_id', tenant.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: tenant } = await supabase.from('tenants').select('id').eq('owner_id', user.id).single()
  if (!tenant) return NextResponse.json({ error: 'No tenant' }, { status: 404 })

  const { searchParams } = new URL(request.url)
  const table = searchParams.get('table') === 'room_types' ? 'room_types' : 'rooms'

  const { error } = await supabase.from(table).delete().eq('id', id).eq('tenant_id', tenant.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/rooms/
git commit -m "feat: add /api/rooms CRUD routes for room_types and rooms"
```

---

## Task 7: Reservations Page

**Files:**
- Create: `src/components/reservations/ReservationTable.tsx`
- Create: `src/app/(dashboard)/reservations/page.tsx`

- [ ] **Step 1: Create `src/components/reservations/ReservationTable.tsx`**

```typescript
'use client'
import { useState, useEffect, useCallback } from 'react'
import { format } from 'date-fns'
import { bg } from 'date-fns/locale'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { MoreHorizontal, ChevronLeft, ChevronRight, Phone, MessageSquare } from 'lucide-react'

type Reservation = {
  id: string
  guest_name: string
  guest_phone: string
  check_in_date: string
  check_out_date: string | null
  status: string
  channel: string
  notes: string | null
}

const statusColors: Record<string, string> = {
  confirmed: 'bg-green-500/10 text-green-400 border-green-500/30',
  cancelled: 'bg-red-500/10 text-red-400 border-red-500/30',
  completed: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
  no_show: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30',
}

const statusLabels: Record<string, string> = {
  confirmed: 'Потвърдена',
  cancelled: 'Отменена',
  completed: 'Завършена',
  no_show: 'Неявил се',
}

export function ReservationTable() {
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const pageSize = 20

  const fetchReservations = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page) })
      if (statusFilter !== 'all') params.set('status', statusFilter)
      if (fromDate) params.set('from', `${fromDate}T00:00:00`)
      if (toDate) params.set('to', `${toDate}T23:59:59`)

      const res = await fetch(`/api/reservations?${params}`)
      if (!res.ok) throw new Error('Failed to fetch')
      const data = await res.json()
      setReservations(data.reservations || [])
      setTotal(data.total || 0)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [page, statusFilter, fromDate, toDate])

  useEffect(() => { fetchReservations() }, [fetchReservations])

  const updateStatus = async (id: string, status: string) => {
    await fetch(`/api/reservations/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    await fetchReservations()
  }

  const totalPages = Math.ceil(total / pageSize)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <Select
          value={statusFilter}
          onValueChange={(val) => { setStatusFilter(val ?? 'all'); setPage(1) }}
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Статус" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Всички</SelectItem>
            <SelectItem value="confirmed">Потвърдена</SelectItem>
            <SelectItem value="completed">Завършена</SelectItem>
            <SelectItem value="cancelled">Отменена</SelectItem>
            <SelectItem value="no_show">Неявил се</SelectItem>
          </SelectContent>
        </Select>
        <Input type="date" value={fromDate} onChange={e => { setFromDate(e.target.value); setPage(1) }} className="w-40" placeholder="От дата" />
        <Input type="date" value={toDate} onChange={e => { setToDate(e.target.value); setPage(1) }} className="w-40" placeholder="До дата" />
        {(statusFilter !== 'all' || fromDate || toDate) && (
          <Button variant="ghost" size="sm" onClick={() => { setStatusFilter('all'); setFromDate(''); setToDate(''); setPage(1) }}>
            Изчисти
          </Button>
        )}
      </div>

      <div className="rounded-lg border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent">
              <TableHead className="text-muted-foreground">Check-in / Check-out</TableHead>
              <TableHead className="text-muted-foreground">Гост</TableHead>
              <TableHead className="text-muted-foreground">Канал</TableHead>
              <TableHead className="text-muted-foreground">Статус</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-12">Зареждане...</TableCell>
              </TableRow>
            ) : reservations.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-12">Няма намерени резервации</TableCell>
              </TableRow>
            ) : reservations.map(r => (
              <TableRow key={r.id} className="border-border">
                <TableCell className="font-mono text-sm">
                  {format(new Date(r.check_in_date), 'dd MMM yyyy', { locale: bg })}
                  {r.check_out_date && (
                    <><br /><span className="text-muted-foreground">{format(new Date(r.check_out_date), 'dd MMM yyyy', { locale: bg })}</span></>
                  )}
                </TableCell>
                <TableCell>
                  <p className="font-medium">{r.guest_name}</p>
                  <p className="text-xs text-muted-foreground">{r.guest_phone}</p>
                </TableCell>
                <TableCell>
                  {r.channel === 'phone' ? (
                    <Badge variant="outline" className="bg-blue-500/10 text-blue-400 border-blue-500/30 gap-1">
                      <Phone className="h-3 w-3" /> Телефон
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="bg-purple-500/10 text-purple-400 border-purple-500/30 gap-1">
                      <MessageSquare className="h-3 w-3" /> Чат
                    </Badge>
                  )}
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className={statusColors[r.status]}>
                    {statusLabels[r.status] || r.status}
                  </Badge>
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger className="inline-flex items-center justify-center rounded-md h-8 w-8 text-muted-foreground hover:bg-accent transition-colors">
                      <MoreHorizontal className="h-4 w-4" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {r.status !== 'cancelled' && (
                        <DropdownMenuItem className="text-red-400 focus:text-red-400" onClick={() => updateStatus(r.id, 'cancelled')}>
                          Отмени
                        </DropdownMenuItem>
                      )}
                      {r.status !== 'completed' && (
                        <DropdownMenuItem className="text-blue-400 focus:text-blue-400" onClick={() => updateStatus(r.id, 'completed')}>
                          Маркирай като завършена
                        </DropdownMenuItem>
                      )}
                      {r.status !== 'no_show' && (
                        <DropdownMenuItem className="text-yellow-400 focus:text-yellow-400" onClick={() => updateStatus(r.id, 'no_show')}>
                          Маркирай като неявил се
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">Общо {total} резервации</p>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm">{page} / {totalPages}</span>
            <Button variant="outline" size="icon" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Create `src/app/(dashboard)/reservations/page.tsx`**

```typescript
import { ReservationTable } from '@/components/reservations/ReservationTable'

export default function ReservationsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Резервации</h1>
        <p className="text-muted-foreground">Управлявайте всички резервации</p>
      </div>
      <ReservationTable />
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/reservations/ src/app/(dashboard)/reservations/
git commit -m "feat: add Резервации page with ReservationTable component"
```

---

## Task 8: Rooms Page

**Files:**
- Create: `src/components/rooms/RoomTypesTab.tsx`
- Create: `src/components/rooms/RoomsTab.tsx`
- Create: `src/app/(dashboard)/rooms/page.tsx`

- [ ] **Step 1: Create `src/components/rooms/RoomTypesTab.tsx`**

```typescript
'use client'
import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import type { RoomTypeRow } from '@/types/database'

interface Props {
  roomTypes: RoomTypeRow[]
  onRefresh: () => void
}

export function RoomTypesTab({ roomTypes, onRefresh }: Props) {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ name: '', description: '', capacity: '2', price_per_night: '' })
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    await fetch('/api/rooms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'room_type',
        name: form.name,
        description: form.description || null,
        capacity: parseInt(form.capacity),
        price_per_night: parseFloat(form.price_per_night),
      }),
    })
    setSaving(false)
    setOpen(false)
    setForm({ name: '', description: '', capacity: '2', price_per_night: '' })
    onRefresh()
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Изтрий този тип стая?')) return
    await fetch(`/api/rooms/${id}?table=room_types`, { method: 'DELETE' })
    onRefresh()
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="h-4 w-4 mr-2" />Добави тип</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Нов тип стая</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Наименование *</Label>
                <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Стандартна, Делукс, Апартамент..." />
              </div>
              <div className="space-y-2">
                <Label>Описание</Label>
                <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Кратко описание на стаята" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Капацитет (гости)</Label>
                  <Input type="number" min="1" value={form.capacity} onChange={e => setForm(f => ({ ...f, capacity: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Цена/нощ (лв) *</Label>
                  <Input type="number" min="0" step="0.01" value={form.price_per_night} onChange={e => setForm(f => ({ ...f, price_per_night: e.target.value }))} placeholder="120.00" />
                </div>
              </div>
              <Button onClick={handleSave} disabled={saving || !form.name || !form.price_per_night} className="w-full">
                {saving ? 'Запазване...' : 'Запази'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {roomTypes.length === 0 ? (
        <p className="text-muted-foreground text-sm text-center py-12">Няма добавени типове стаи. Добавете първия тип.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {roomTypes.map(rt => (
            <Card key={rt.id} className="border-border">
              <CardHeader className="flex flex-row items-start justify-between pb-2">
                <CardTitle className="text-base">{rt.name}</CardTitle>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDelete(rt.id)}>
                    <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {rt.description && <p className="text-sm text-muted-foreground mb-3">{rt.description}</p>}
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">До {rt.capacity} гости</span>
                  <span className="font-semibold">{rt.price_per_night} лв/нощ</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Create `src/components/rooms/RoomsTab.tsx`**

```typescript
'use client'
import { useState } from 'react'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Plus } from 'lucide-react'
import type { RoomRow, RoomTypeRow } from '@/types/database'

interface Props {
  rooms: RoomRow[]
  roomTypes: RoomTypeRow[]
  onRefresh: () => void
}

const statusColors: Record<string, string> = {
  free: 'bg-green-500/10 text-green-400 border-green-500/30',
  occupied: 'bg-red-500/10 text-red-400 border-red-500/30',
  cleaning: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30',
  maintenance: 'bg-gray-500/10 text-gray-400 border-gray-500/30',
}

const statusLabels: Record<string, string> = {
  free: 'Свободна',
  occupied: 'Заета',
  cleaning: 'Почистване',
  maintenance: 'Ремонт',
}

export function RoomsTab({ rooms, roomTypes, onRefresh }: Props) {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ room_number: '', name: '', room_type_id: '' })
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    await fetch('/api/rooms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'room',
        room_number: form.room_number || null,
        name: form.name || null,
        room_type_id: form.room_type_id,
      }),
    })
    setSaving(false)
    setOpen(false)
    setForm({ room_number: '', name: '', room_type_id: '' })
    onRefresh()
  }

  const handleStatusChange = async (id: string, status: string) => {
    await fetch(`/api/rooms/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ table: 'rooms', status }),
    })
    onRefresh()
  }

  if (roomTypes.length === 0) {
    return <p className="text-muted-foreground text-sm text-center py-12">Добавете типове стаи първо, след това добавете конкретни стаи.</p>
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="h-4 w-4 mr-2" />Добави стая</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Нова стая</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Тип стая *</Label>
                <Select value={form.room_type_id} onValueChange={v => setForm(f => ({ ...f, room_type_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Изберете тип" /></SelectTrigger>
                  <SelectContent>
                    {roomTypes.map(rt => <SelectItem key={rt.id} value={rt.id}>{rt.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Номер (по избор)</Label>
                  <Input value={form.room_number} onChange={e => setForm(f => ({ ...f, room_number: e.target.value }))} placeholder="101" />
                </div>
                <div className="space-y-2">
                  <Label>Име (по избор)</Label>
                  <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Морска стая" />
                </div>
              </div>
              <Button onClick={handleSave} disabled={saving || !form.room_type_id} className="w-full">
                {saving ? 'Запазване...' : 'Запази'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {rooms.length === 0 ? (
        <p className="text-muted-foreground text-sm text-center py-12">Няма добавени стаи.</p>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="text-muted-foreground">Стая</TableHead>
                <TableHead className="text-muted-foreground">Тип</TableHead>
                <TableHead className="text-muted-foreground">Статус</TableHead>
                <TableHead className="text-muted-foreground">Промени статус</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rooms.map(room => {
                const roomType = roomTypes.find(rt => rt.id === room.room_type_id)
                return (
                  <TableRow key={room.id} className="border-border">
                    <TableCell className="font-medium">
                      {room.room_number ? `Стая ${room.room_number}` : room.name || '—'}
                      {room.room_number && room.name && <span className="text-xs text-muted-foreground ml-2">{room.name}</span>}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{roomType?.name || '—'}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={statusColors[room.status]}>
                        {statusLabels[room.status]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Select value={room.status} onValueChange={v => handleStatusChange(room.id, v)}>
                        <SelectTrigger className="w-36 h-7 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="free">Свободна</SelectItem>
                          <SelectItem value="occupied">Заета</SelectItem>
                          <SelectItem value="cleaning">Почистване</SelectItem>
                          <SelectItem value="maintenance">Ремонт</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Create `src/app/(dashboard)/rooms/page.tsx`**

```typescript
'use client'
import { useState, useEffect, useCallback } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { RoomTypesTab } from '@/components/rooms/RoomTypesTab'
import { RoomsTab } from '@/components/rooms/RoomsTab'
import type { RoomTypeRow, RoomRow } from '@/types/database'

export default function RoomsPage() {
  const [roomTypes, setRoomTypes] = useState<RoomTypeRow[]>([])
  const [rooms, setRooms] = useState<RoomRow[]>([])

  const fetchRooms = useCallback(async () => {
    const res = await fetch('/api/rooms')
    if (!res.ok) return
    const data = await res.json()
    setRoomTypes(data.roomTypes || [])
    setRooms(data.rooms || [])
  }, [])

  useEffect(() => { fetchRooms() }, [fetchRooms])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Стаи</h1>
        <p className="text-muted-foreground">Управлявайте типовете и конкретните стаи</p>
      </div>
      <Tabs defaultValue="types">
        <TabsList>
          <TabsTrigger value="types">Типове стаи</TabsTrigger>
          <TabsTrigger value="rooms">Стаи</TabsTrigger>
        </TabsList>
        <TabsContent value="types" className="mt-4">
          <RoomTypesTab roomTypes={roomTypes} onRefresh={fetchRooms} />
        </TabsContent>
        <TabsContent value="rooms" className="mt-4">
          <RoomsTab rooms={rooms} roomTypes={roomTypes} onRefresh={fetchRooms} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add src/components/rooms/ src/app/(dashboard)/rooms/
git commit -m "feat: add Стаи page with RoomTypesTab and RoomsTab"
```

---

## Task 9: Today Page

**Files:**
- Create: `src/app/(dashboard)/today/page.tsx`

- [ ] **Step 1: Create the page**

```typescript
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { format, startOfDay, endOfDay } from 'date-fns'
import { bg } from 'date-fns/locale'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { ReservationRow } from '@/types/database'

export default async function TodayPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: tenant } = await supabase.from('tenants').select('id, business_name').eq('owner_id', user.id).single()
  if (!tenant) redirect('/onboarding')

  const now = new Date()
  const todayStart = startOfDay(now).toISOString()
  const todayEnd = endOfDay(now).toISOString()
  const todayLabel = format(now, 'dd MMMM yyyy', { locale: bg })

  const [{ data: checkinsData }, { data: checkoutsData }] = await Promise.all([
    supabase
      .from('reservations')
      .select('*')
      .eq('tenant_id', tenant.id)
      .gte('check_in_date', todayStart)
      .lte('check_in_date', todayEnd)
      .in('status', ['confirmed'])
      .order('check_in_date'),
    supabase
      .from('reservations')
      .select('*')
      .eq('tenant_id', tenant.id)
      .gte('check_out_date', todayStart)
      .lte('check_out_date', todayEnd)
      .in('status', ['confirmed'])
      .order('check_out_date'),
  ])

  const checkins = (checkinsData || []) as ReservationRow[]
  const checkouts = (checkoutsData || []) as ReservationRow[]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Днес</h1>
        <p className="text-muted-foreground">{todayLabel}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <span className="text-green-400">↓</span> Пристигащи ({checkins.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {checkins.length === 0 ? (
              <p className="text-muted-foreground text-sm">Няма пристигащи днес</p>
            ) : (
              <div className="space-y-3">
                {checkins.map(r => (
                  <div key={r.id} className="flex items-center justify-between p-3 rounded-md bg-muted/30">
                    <div>
                      <p className="font-medium text-sm">{r.guest_name}</p>
                      <p className="text-xs text-muted-foreground">{r.guest_phone}</p>
                      {r.check_out_date && (
                        <p className="text-xs text-muted-foreground">
                          до {format(new Date(r.check_out_date), 'dd MMM', { locale: bg })}
                        </p>
                      )}
                    </div>
                    <Badge variant="outline" className="bg-green-500/10 text-green-400 border-green-500/30">
                      Check-in
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <span className="text-blue-400">↑</span> Напускащи ({checkouts.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {checkouts.length === 0 ? (
              <p className="text-muted-foreground text-sm">Няма напускащи днес</p>
            ) : (
              <div className="space-y-3">
                {checkouts.map(r => (
                  <div key={r.id} className="flex items-center justify-between p-3 rounded-md bg-muted/30">
                    <div>
                      <p className="font-medium text-sm">{r.guest_name}</p>
                      <p className="text-xs text-muted-foreground">{r.guest_phone}</p>
                      <p className="text-xs text-muted-foreground">
                        от {format(new Date(r.check_in_date), 'dd MMM', { locale: bg })}
                      </p>
                    </div>
                    <Badge variant="outline" className="bg-blue-500/10 text-blue-400 border-blue-500/30">
                      Check-out
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/(dashboard)/today/
git commit -m "feat: add Днес page with check-ins and check-outs"
```

---

## Task 10: AI Prompt + API Route Updates

**Files:**
- Modify: `src/lib/ai/prompt-generator.ts`
- Modify: `src/app/api/vapi/[tenantId]/tool-call/route.ts`
- Modify: `src/app/api/chat/[apiKey]/route.ts`

- [ ] **Step 1: Update `src/lib/ai/prompt-generator.ts`**

```typescript
export interface FaqItem {
  question: string
  answer: string
}

export interface RoomTypeItem {
  name: string
  capacity: number
  price_per_night: number
  description?: string | null
}

export interface HotelProfile {
  business_name: string
  address: string
  room_types: RoomTypeItem[]
  faqs: FaqItem[]
  booking_rules: string
  welcome_message_bg: string
}

export function generateSystemPrompt(profile: HotelProfile, languages: string[]): string {
  const roomTypesText = profile.room_types
    .map(r => `- ${r.name}: до ${r.capacity} гости, ${r.price_per_night} лв/нощ${r.description ? ` (${r.description})` : ''}`)
    .join('\n')

  const faqsText = profile.faqs
    .map(f => `В: ${f.question}\nО: ${f.answer}`)
    .join('\n\n')

  const langInstruction = languages.includes('en')
    ? 'Detect the language of the caller and respond in the same language (Bulgarian or English).'
    : 'Говори само на български.'

  return `Ти си AI рецепционист на хотел ${profile.business_name}.
Адрес: ${profile.address}.

ТИПОВЕ СТАИ:
${roomTypesText || 'Не са посочени типове стаи.'}

ЧЗВ:
${faqsText || 'Не са посочени ЧЗВ.'}

${profile.booking_rules ? `СПЕЦИАЛНИ ПРАВИЛА:\n${profile.booking_rules}\n` : ''}ЗАДАЧИ:
1. Отговаряй на въпроси за хотела, стаите, цените и удобствата
2. Записвай резервации: питай за тип стая → дата на настаняване → дата на напускане → брой гости → ime и телефон
3. ${langInstruction}
4. При неясна ситуация предложи да се обади отново

ВАЖНО: Не измисляй информация. Бъди учтив и кратък.`
}
```

- [ ] **Step 2: Update vapi tool-call route — rename table references and fields**

In `src/app/api/vapi/[tenantId]/tool-call/route.ts`, make these changes:

Change `.from('appointments')` → `.from('reservations')`

Change `patient_name` → `guest_name`, `patient_phone` → `guest_phone`

Change `starts_at` → `check_in_date`, `ends_at` → `check_out_date`

Change the message strings:
- `'На тази дата клиниката е затворена.'` → `'На тази дата хотелът не приема резервации.'`
- `'Свободни часове на ${date}: ${slots.join(', ')}'` → `'Свободни стаи: ${slots.join(', ')}'`
- `'Няма свободни часове на ${date}.'` → `'Няма свободни стаи за тази дата.'`
- `'Съжалявам, този час вече е зает. Моля изберете друг.'` → `'Съжалявам, тази стая вече е резервирана за тези дати. Моля изберете друг тип.'`
- `'Грешка при записване. Моля опитайте отново.'` → `'Грешка при резервацията. Моля опитайте отново.'`
- The success message: `'Часът е записан успешно! ${patient_name}...'` → `'Резервацията е потвърдена! ${guest_name}, настанявате се на ${format(startDate, 'dd.MM.yyyy')}. Ще получите потвърждение.'`

Also rename the tool parameter names in `book_appointment`:
- `patient_name` → `guest_name`
- `patient_phone` → `guest_phone`
- `service` → `room_type`
- `starts_at` → `check_in_date`
- Add `check_out_date` parameter

Full updated file:

```typescript
import { createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { parseISO, format } from 'date-fns'

interface ToolCallPayload {
  message?: {
    toolCalls?: Array<{
      function?: {
        name?: string
        arguments?: string
      }
    }>
  }
  toolName?: string
  parameters?: Record<string, unknown>
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ tenantId: string }> }
) {
  const { tenantId } = await params

  const signature = request.headers.get('x-vapi-signature')
  const body = await request.text()

  if (process.env.VAPI_WEBHOOK_SECRET && signature) {
    const expected = crypto
      .createHmac('sha256', process.env.VAPI_WEBHOOK_SECRET)
      .update(body)
      .digest('hex')
    if (signature !== expected) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const payload = JSON.parse(body) as ToolCallPayload
  const toolName = payload.message?.toolCalls?.[0]?.function?.name || payload.toolName
  const rawArgs = payload.message?.toolCalls?.[0]?.function?.arguments
  const parameters = rawArgs
    ? (JSON.parse(rawArgs) as Record<string, string>)
    : (payload.parameters as Record<string, string>) || {}

  const supabase = await createServiceClient()

  if (toolName === 'get_available_room_types') {
    const { data: roomTypes } = await supabase
      .from('room_types')
      .select('name, capacity, price_per_night')
      .eq('tenant_id', tenantId)

    if (!roomTypes || roomTypes.length === 0) {
      return NextResponse.json({ result: 'Няма налични типове стаи.' })
    }

    const list = roomTypes.map(r => `${r.name} (до ${r.capacity} гости, ${r.price_per_night} лв/нощ)`).join(', ')
    return NextResponse.json({ result: `Налични типове стаи: ${list}` })
  }

  if (toolName === 'book_reservation') {
    const { guest_name, guest_phone, room_type, check_in_date, check_out_date } = parameters

    const { data: existing } = await supabase
      .from('reservations')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('check_in_date', check_in_date)
      .in('status', ['confirmed'])
      .single()

    if (existing) {
      return NextResponse.json({ result: 'Съжалявам, тази стая вече е резервирана за тези дати. Моля изберете друг тип.' })
    }

    const { data: reservation, error } = await supabase
      .from('reservations')
      .insert({
        tenant_id: tenantId,
        guest_name,
        guest_phone,
        check_in_date,
        check_out_date: check_out_date || null,
        status: 'confirmed',
        channel: 'phone',
        notes: room_type ? `Тип стая: ${room_type}` : null,
      })
      .select('id')
      .single()

    if (error || !reservation) {
      return NextResponse.json({ result: 'Грешка при резервацията. Моля опитайте отново.' })
    }

    const checkIn = parseISO(check_in_date)
    return NextResponse.json({
      result: `Резервацията е потвърдена! ${guest_name}, настанявате се на ${format(checkIn, 'dd.MM.yyyy')}. Ще получите потвърждение.`
    })
  }

  if (toolName === 'get_business_info') {
    const { data: tenant } = await supabase
      .from('tenants')
      .select('business_name, address, phone')
      .eq('id', tenantId)
      .single()

    const { data: roomTypes } = await supabase
      .from('room_types')
      .select('name, capacity, price_per_night')
      .eq('tenant_id', tenantId)

    const info = [
      tenant?.business_name ? `Хотел: ${tenant.business_name}` : '',
      tenant?.address ? `Адрес: ${tenant.address}` : '',
      tenant?.phone ? `Телефон: ${tenant.phone}` : '',
      roomTypes?.length ? `Стаи: ${roomTypes.map(r => r.name).join(', ')}` : '',
    ].filter(Boolean).join('\n')

    return NextResponse.json({ result: info || 'Информацията не е налична.' })
  }

  return NextResponse.json({ result: 'Неизвестна команда.' })
}
```

- [ ] **Step 3: Update chat API route — rename fields and tools**

In `src/app/api/chat/[apiKey]/route.ts`:

Replace the `tools` array and the `book_appointment` handler. Key changes:
- Tool `get_available_slots` → `get_available_room_types`
- Tool `book_appointment` → `book_reservation` with fields: `guest_name`, `guest_phone`, `room_type`, `check_in_date`, `check_out_date`
- `.from('appointments')` → `.from('reservations')`
- `patient_name` → `guest_name`, `patient_phone` → `guest_phone`
- `starts_at` → `check_in_date`, `ends_at` → `check_out_date`
- Success message: `'Резервацията е потвърдена! ID: ${reservation.id}'`
- Also update the `generateSystemPrompt` call to pass `room_types` instead of `services`

Replace the `tools` const:

```typescript
const tools: Anthropic.Tool[] = [
  {
    name: 'get_available_room_types',
    description: 'Get available room types with prices and capacity',
    input_schema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },
  {
    name: 'book_reservation',
    description: 'Book a hotel reservation',
    input_schema: {
      type: 'object' as const,
      properties: {
        guest_name: { type: 'string' },
        guest_phone: { type: 'string' },
        room_type: { type: 'string', description: 'Room type name' },
        check_in_date: { type: 'string', description: 'Check-in date YYYY-MM-DD' },
        check_out_date: { type: 'string', description: 'Check-out date YYYY-MM-DD' },
      },
      required: ['guest_name', 'guest_phone', 'room_type', 'check_in_date'],
    },
  },
]
```

Replace the tool execution block for `get_available_room_types`:

```typescript
if (toolCall.name === 'get_available_room_types') {
  const { data: roomTypes } = await supabase
    .from('room_types')
    .select('name, capacity, price_per_night')
    .eq('tenant_id', tenant.id)

  const list = roomTypes?.map(r => `${r.name}: до ${r.capacity} гости, ${r.price_per_night} лв/нощ`).join('; ')
  toolResults.push({
    type: 'tool_result',
    tool_use_id: toolCall.id,
    content: list ? `Налични стаи: ${list}` : 'Няма налични стаи.',
  })
}

if (toolCall.name === 'book_reservation') {
  const { data: reservation, error } = await supabase
    .from('reservations')
    .insert({
      tenant_id: tenant.id,
      guest_name: args.guest_name,
      guest_phone: args.guest_phone,
      check_in_date: args.check_in_date,
      check_out_date: args.check_out_date || null,
      status: 'confirmed',
      channel: 'chat',
      notes: args.room_type ? `Тип стая: ${args.room_type}` : null,
    })
    .select('id')
    .single()

  toolResults.push({
    type: 'tool_result',
    tool_use_id: toolCall.id,
    content: error || !reservation
      ? 'Грешка при резервацията.'
      : `Резервацията е потвърдена! ID: ${reservation.id}`,
  })
}
```

Also update the `generateSystemPrompt` call:

```typescript
const { data: roomTypesData } = await supabase
  .from('room_types')
  .select('name, capacity, price_per_night, description')
  .eq('tenant_id', tenant.id)

const systemPrompt = generateSystemPrompt({
  business_name: tenant.business_name,
  address: tenant.address || '',
  room_types: roomTypesData || [],
  faqs: profile?.faqs || [],
  booking_rules: profile?.booking_rules || '',
  welcome_message_bg: profile?.welcome_message_bg || 'Здравейте!',
}, tenant.languages || ['bg'])
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/ai/prompt-generator.ts src/app/api/vapi/ src/app/api/chat/
git commit -m "feat: update AI prompt and tool definitions for hotel reservations"
```

---

## Task 11: Settings & Onboarding Text

**Files:**
- Modify: `src/components/settings/ProfileEditor.tsx` (add "хотел" context text)
- Modify: `src/components/onboarding/steps/Step1BusinessProfile.tsx` (placeholder text)
- Modify: `src/app/(dashboard)/settings/profile/page.tsx`
- Modify: `src/app/(dashboard)/settings/schedule/page.tsx`

- [ ] **Step 1: Update settings/profile page description**

In `src/app/(dashboard)/settings/profile/page.tsx`, find and replace:
- `"Основна информация за вашата клиника"` → `"Основна информация за вашия хотел"`

- [ ] **Step 2: Update settings/schedule page description**

In `src/app/(dashboard)/settings/schedule/page.tsx`, find and replace:
- `"клиниката"` → `"хотела"`

- [ ] **Step 3: Update Step1BusinessProfile placeholder**

In `src/components/onboarding/steps/Step1BusinessProfile.tsx`:
- `placeholder="Дентален Център Иванов"` → `placeholder="Хотел Морски Бриз"`
- `placeholder="dentalen-centyr-ivanov"` → `placeholder="hotel-morski-briz"`

- [ ] **Step 4: Commit**

```bash
git add src/components/settings/ src/components/onboarding/ src/app/(dashboard)/settings/
git commit -m "fix: update settings and onboarding text from clinic to hotel context"
```

---

## Task 12: Redirects for Old Routes

**Files:**
- Modify: `src/app/(dashboard)/appointments/page.tsx`
- Modify: `src/app/(dashboard)/calendar/page.tsx`

- [ ] **Step 1: Redirect /appointments → /reservations**

Replace the entire `src/app/(dashboard)/appointments/page.tsx`:

```typescript
import { redirect } from 'next/navigation'

export default function AppointmentsPage() {
  redirect('/reservations')
}
```

- [ ] **Step 2: Redirect /calendar → /today**

Replace the entire `src/app/(dashboard)/calendar/page.tsx`:

```typescript
import { redirect } from 'next/navigation'

export default function CalendarPage() {
  redirect('/today')
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/(dashboard)/appointments/page.tsx src/app/(dashboard)/calendar/page.tsx
git commit -m "feat: redirect /appointments→/reservations and /calendar→/today"
```

---

## Task 13: Final Verification

- [ ] **Step 1: Check TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors (or only pre-existing errors)

- [ ] **Step 2: Start dev server and manually verify**

```bash
npm run dev
```

Check each route loads without errors:
- `/dashboard` — shows hotel KPI cards
- `/today` — shows check-ins / check-outs sections
- `/reservations` — shows reservation table
- `/rooms` — shows two tabs (Типове стаи, Стаи)
- `/appointments` — redirects to `/reservations`
- `/calendar` — redirects to `/today`

- [ ] **Step 3: Final commit**

```bash
git add -A
git commit -m "chore: complete hotel rebrand — dental→hotel terminology throughout"
```

---

## Task 14: Fix Dashboard KPI Queries (Reviewer Issue)

**Files:**
- Modify: `src/app/(dashboard)/dashboard/page.tsx`

The Task 4 dashboard page fetches only `limit(5)` reservations and then tries to count today's check-ins/check-outs from that subset. Replace the data-fetching logic with separate focused queries:

- [ ] **Step 1: Replace the data fetching in dashboard/page.tsx**

Replace the three `Promise.all` queries and stats block with:

```typescript
const today = format(now, 'yyyy-MM-dd')

const [
  { data: checkinsData },
  { data: checkoutsData },
  { data: conversationsData },
  { data: roomsData },
  { data: recentData },
] = await Promise.all([
  supabase
    .from('reservations')
    .select('id', { count: 'exact' })
    .eq('tenant_id', tenant.id)
    .gte('check_in_date', `${today}T00:00:00`)
    .lte('check_in_date', `${today}T23:59:59`)
    .in('status', ['confirmed']),
  supabase
    .from('reservations')
    .select('id', { count: 'exact' })
    .eq('tenant_id', tenant.id)
    .gte('check_out_date', `${today}T00:00:00`)
    .lte('check_out_date', `${today}T23:59:59`)
    .in('status', ['confirmed']),
  supabase
    .from('conversations')
    .select('channel')
    .eq('tenant_id', tenant.id)
    .gte('created_at', `${weekStart}T00:00:00`)
    .lte('created_at', `${weekEnd}T23:59:59`),
  supabase
    .from('rooms')
    .select('status')
    .eq('tenant_id', tenant.id),
  supabase
    .from('reservations')
    .select('*')
    .eq('tenant_id', tenant.id)
    .order('check_in_date', { ascending: false })
    .limit(5),
])

const rooms = (roomsData || []) as { status: string }[]
const convs = (conversationsData || []) as { channel: string }[]
const occupiedRooms = rooms.filter(r => r.status === 'occupied').length
const occupancyPercent = rooms.length > 0 ? Math.round((occupiedRooms / rooms.length) * 100) : 0

const stats = {
  occupancy_percent: occupancyPercent,
  checkins_today: checkinsData?.length ?? 0,
  checkouts_today: checkoutsData?.length ?? 0,
  total_calls_week: convs.filter(c => c.channel === 'phone').length,
}

const reservations = (recentData || []) as ReservationRow[]
```

Remove the unused `startOfDay`, `endOfDay` imports if they were added. Keep `startOfWeek`, `endOfWeek`, `format`.

- [ ] **Step 2: Commit**

```bash
git add src/app/(dashboard)/dashboard/page.tsx
git commit -m "fix: dashboard KPI queries use separate focused DB queries"
```

---

## Task 15: Today Page — Add Action Buttons (Reviewer Issue)

**Files:**
- Create: `src/components/today/TodayCheckinCard.tsx`
- Create: `src/components/today/TodayCheckoutCard.tsx`
- Modify: `src/app/(dashboard)/today/page.tsx`

The Today page must have a "Настани" button (assigns a room) and "Освободи стая" button (sets room to cleaning). Convert the cards into client components.

- [ ] **Step 1: Create `src/components/today/TodayCheckinCard.tsx`**

```typescript
'use client'
import { useState } from 'react'
import { format } from 'date-fns'
import { bg } from 'date-fns/locale'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { ReservationRow, RoomRow } from '@/types/database'

interface Props {
  reservation: ReservationRow
  availableRooms: RoomRow[]
  onCheckedIn: () => void
}

export function TodayCheckinCard({ reservation, availableRooms, onCheckedIn }: Props) {
  const [open, setOpen] = useState(false)
  const [selectedRoom, setSelectedRoom] = useState('')
  const [saving, setSaving] = useState(false)

  const handleCheckin = async () => {
    setSaving(true)
    // Assign room to reservation
    await fetch(`/api/reservations/${reservation.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ room_id: selectedRoom }),
    })
    // Mark room as occupied
    if (selectedRoom) {
      await fetch(`/api/rooms/${selectedRoom}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ table: 'rooms', status: 'occupied' }),
      })
    }
    setSaving(false)
    setOpen(false)
    onCheckedIn()
  }

  return (
    <div className="flex items-center justify-between p-3 rounded-md bg-muted/30">
      <div>
        <p className="font-medium text-sm">{reservation.guest_name}</p>
        <p className="text-xs text-muted-foreground">{reservation.guest_phone}</p>
        {reservation.check_out_date && (
          <p className="text-xs text-muted-foreground">
            до {format(new Date(reservation.check_out_date), 'dd MMM', { locale: bg })}
          </p>
        )}
      </div>
      <Button size="sm" onClick={() => setOpen(true)}>Настани</Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Настани {reservation.guest_name}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            {availableRooms.length === 0 ? (
              <p className="text-sm text-muted-foreground">Няма свободни стаи. Назначете стая след освобождаване.</p>
            ) : (
              <Select value={selectedRoom} onValueChange={setSelectedRoom}>
                <SelectTrigger><SelectValue placeholder="Изберете стая" /></SelectTrigger>
                <SelectContent>
                  {availableRooms.map(r => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.room_number ? `Стая ${r.room_number}` : r.name || r.id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setOpen(false)}>Отказ</Button>
              <Button onClick={handleCheckin} disabled={saving || !selectedRoom}>
                {saving ? 'Запазване...' : 'Потвърди'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
```

- [ ] **Step 2: Create `src/components/today/TodayCheckoutCard.tsx`**

```typescript
'use client'
import { useState } from 'react'
import { format } from 'date-fns'
import { bg } from 'date-fns/locale'
import { Button } from '@/components/ui/button'
import type { ReservationRow } from '@/types/database'

interface Props {
  reservation: ReservationRow
  onCheckedOut: () => void
}

export function TodayCheckoutCard({ reservation, onCheckedOut }: Props) {
  const [saving, setSaving] = useState(false)

  const handleCheckout = async () => {
    setSaving(true)
    // Mark reservation as completed
    await fetch(`/api/reservations/${reservation.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'completed' }),
    })
    // Mark room as cleaning if assigned
    if (reservation.room_id) {
      await fetch(`/api/rooms/${reservation.room_id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ table: 'rooms', status: 'cleaning' }),
      })
    }
    setSaving(false)
    onCheckedOut()
  }

  return (
    <div className="flex items-center justify-between p-3 rounded-md bg-muted/30">
      <div>
        <p className="font-medium text-sm">{reservation.guest_name}</p>
        <p className="text-xs text-muted-foreground">{reservation.guest_phone}</p>
        <p className="text-xs text-muted-foreground">
          от {format(new Date(reservation.check_in_date), 'dd MMM', { locale: bg })}
        </p>
      </div>
      <Button size="sm" variant="outline" onClick={handleCheckout} disabled={saving}>
        {saving ? '...' : 'Освободи стая'}
      </Button>
    </div>
  )
}
```

- [ ] **Step 3: Replace Today page to use client components**

Replace the full `src/app/(dashboard)/today/page.tsx` with a client component:

```typescript
'use client'
import { useState, useEffect, useCallback } from 'react'
import { format } from 'date-fns'
import { bg } from 'date-fns/locale'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { TodayCheckinCard } from '@/components/today/TodayCheckinCard'
import { TodayCheckoutCard } from '@/components/today/TodayCheckoutCard'
import type { ReservationRow, RoomRow } from '@/types/database'

export default function TodayPage() {
  const [checkins, setCheckins] = useState<ReservationRow[]>([])
  const [checkouts, setCheckouts] = useState<ReservationRow[]>([])
  const [freeRooms, setFreeRooms] = useState<RoomRow[]>([])

  const fetchData = useCallback(async () => {
    const today = format(new Date(), 'yyyy-MM-dd')

    const [resRes, roomRes] = await Promise.all([
      fetch(`/api/reservations?from=${today}T00:00:00&to=${today}T23:59:59&status=confirmed`),
      fetch('/api/rooms'),
    ])

    if (resRes.ok) {
      const data = await resRes.json()
      const all: ReservationRow[] = data.reservations || []
      setCheckins(all.filter(r => r.check_in_date.startsWith(today)))
      setCheckouts(all.filter(r => r.check_out_date?.startsWith(today)))
    }

    if (roomRes.ok) {
      const data = await roomRes.json()
      setFreeRooms((data.rooms || []).filter((r: RoomRow) => r.status === 'free'))
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const todayLabel = format(new Date(), 'dd MMMM yyyy', { locale: bg })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Днес</h1>
        <p className="text-muted-foreground">{todayLabel}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <span className="text-green-400">↓</span> Пристигащи ({checkins.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {checkins.length === 0 ? (
              <p className="text-muted-foreground text-sm">Няма пристигащи днес</p>
            ) : (
              <div className="space-y-3">
                {checkins.map(r => (
                  <TodayCheckinCard key={r.id} reservation={r} availableRooms={freeRooms} onCheckedIn={fetchData} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <span className="text-blue-400">↑</span> Напускащи ({checkouts.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {checkouts.length === 0 ? (
              <p className="text-muted-foreground text-sm">Няма напускащи днес</p>
            ) : (
              <div className="space-y-3">
                {checkouts.map(r => (
                  <TodayCheckoutCard key={r.id} reservation={r} onCheckedOut={fetchData} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
```

Note: The `/api/reservations` GET route filters by `check_in_date`. To also fetch check-outs today, call the API twice or add a dedicated `/api/today` endpoint. Simplest: call reservations without status filter and split client-side as done above — but the current GET route filters by `status=confirmed` which will miss check-outs with status=confirmed that have `check_out_date` today. The `fetchData` above calls with `status=confirmed` which is correct — both check-ins and check-outs with confirmed status today.

- [ ] **Step 4: Commit**

```bash
git add src/components/today/ src/app/(dashboard)/today/page.tsx
git commit -m "feat: Today page — add Настани and Освободи стая action buttons"
```

---

## Task 16: RoomTypesTab — Add Edit Dialog (Reviewer Issue)

**Files:**
- Modify: `src/components/rooms/RoomTypesTab.tsx`

The Task 8 `RoomTypesTab` imports `Pencil` but never renders it. Add a full edit dialog.

- [ ] **Step 1: Replace RoomTypesTab with edit-capable version**

Add edit state to `RoomTypesTab.tsx`. Add after the `saving` state:

```typescript
const [editOpen, setEditOpen] = useState(false)
const [editTarget, setEditTarget] = useState<RoomTypeRow | null>(null)
const [editForm, setEditForm] = useState({ name: '', description: '', capacity: '2', price_per_night: '' })

const openEdit = (rt: RoomTypeRow) => {
  setEditTarget(rt)
  setEditForm({
    name: rt.name,
    description: rt.description || '',
    capacity: String(rt.capacity),
    price_per_night: String(rt.price_per_night),
  })
  setEditOpen(true)
}

const handleEdit = async () => {
  if (!editTarget) return
  setSaving(true)
  await fetch(`/api/rooms/${editTarget.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      table: 'room_types',
      name: editForm.name,
      description: editForm.description || null,
      capacity: parseInt(editForm.capacity),
      price_per_night: parseFloat(editForm.price_per_night),
    }),
  })
  setSaving(false)
  setEditOpen(false)
  onRefresh()
}
```

Add the edit button in the card (next to the delete button):

```typescript
<Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(rt)}>
  <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
</Button>
```

Add the edit dialog (after the add dialog, inside the return):

```typescript
<Dialog open={editOpen} onOpenChange={setEditOpen}>
  <DialogContent>
    <DialogHeader><DialogTitle>Редактирай {editTarget?.name}</DialogTitle></DialogHeader>
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Наименование *</Label>
        <Input value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} />
      </div>
      <div className="space-y-2">
        <Label>Описание</Label>
        <Textarea value={editForm.description} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Капацитет</Label>
          <Input type="number" min="1" value={editForm.capacity} onChange={e => setEditForm(f => ({ ...f, capacity: e.target.value }))} />
        </div>
        <div className="space-y-2">
          <Label>Цена/нощ (лв)</Label>
          <Input type="number" min="0" step="0.01" value={editForm.price_per_night} onChange={e => setEditForm(f => ({ ...f, price_per_night: e.target.value }))} />
        </div>
      </div>
      <Button onClick={handleEdit} disabled={saving || !editForm.name} className="w-full">
        {saving ? 'Запазване...' : 'Запази промените'}
      </Button>
    </div>
  </DialogContent>
</Dialog>
```

- [ ] **Step 2: Commit**

```bash
git add src/components/rooms/RoomTypesTab.tsx
git commit -m "feat: RoomTypesTab — add edit dialog for room types"
```

---

## Task 17: Fix book_reservation room_type_id (Reviewer Issue)

**Files:**
- Modify: `src/app/api/vapi/[tenantId]/tool-call/route.ts`
- Modify: `src/app/api/chat/[apiKey]/route.ts`

Both routes store `room_type` as a text note instead of resolving to `room_type_id`. Fix to look up the room type by name.

- [ ] **Step 1: In vapi tool-call route, resolve room_type to room_type_id before insert**

In the `book_reservation` handler, add a lookup before the insert:

```typescript
// Look up room_type_id from name
const { data: roomTypeData } = await supabase
  .from('room_types')
  .select('id')
  .eq('tenant_id', tenantId)
  .ilike('name', room_type || '')
  .single()

const { data: reservation, error } = await supabase
  .from('reservations')
  .insert({
    tenant_id: tenantId,
    guest_name,
    guest_phone,
    check_in_date,
    check_out_date: check_out_date || null,
    room_type_id: roomTypeData?.id || null,
    status: 'confirmed',
    channel: 'phone',
  })
  .select('id')
  .single()
```

Remove the `notes: room_type ? \`Тип стая: ${room_type}\` : null` line.

- [ ] **Step 2: Apply same fix in chat API route book_reservation handler**

Same pattern — look up `room_type_id` from `args.room_type` before inserting into `reservations`:

```typescript
const { data: roomTypeData } = await supabase
  .from('room_types')
  .select('id')
  .eq('tenant_id', tenant.id)
  .ilike('name', args.room_type || '')
  .single()

const { data: reservation, error } = await supabase
  .from('reservations')
  .insert({
    tenant_id: tenant.id,
    guest_name: args.guest_name,
    guest_phone: args.guest_phone,
    check_in_date: args.check_in_date,
    check_out_date: args.check_out_date || null,
    room_type_id: roomTypeData?.id || null,
    status: 'confirmed',
    channel: 'chat',
  })
  .select('id')
  .single()
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/vapi/ src/app/api/chat/
git commit -m "fix: resolve room_type name to room_type_id FK when booking reservations"
```

---

## Task 18: Analytics Route + Step2Services (Reviewer Recommendations)

**Files:**
- Modify: `src/app/api/analytics/route.ts`
- Modify: `src/components/onboarding/steps/Step2Services.tsx`

- [ ] **Step 1: Update analytics route — rename table and fields**

Replace `src/app/api/analytics/route.ts` entirely:

```typescript
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { startOfWeek, endOfWeek, format } from 'date-fns'
import type { ReservationRow, ConversationRow } from '@/types/database'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: tenant } = await supabase.from('tenants').select('id').eq('owner_id', user.id).single()
  if (!tenant) return NextResponse.json({ reservations: [], stats: { total: 0, confirmed: 0, cancelled: 0, completed: 0 } })

  const now = new Date()
  const weekStart = format(startOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd')
  const weekEnd = format(endOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd')

  const { data: reservationsData } = await supabase
    .from('reservations')
    .select('*')
    .eq('tenant_id', tenant.id)
    .gte('check_in_date', `${weekStart}T00:00:00`)
    .lte('check_in_date', `${weekEnd}T23:59:59`)
    .order('check_in_date')

  const { data: conversationsData } = await supabase
    .from('conversations')
    .select('*')
    .eq('tenant_id', tenant.id)
    .gte('created_at', `${weekStart}T00:00:00`)
    .lte('created_at', `${weekEnd}T23:59:59`)

  const reservations = (reservationsData || []) as ReservationRow[]
  const convs = (conversationsData || []) as ConversationRow[]

  const stats = {
    total_reservations: reservations.length,
    confirmed: reservations.filter(r => r.status === 'confirmed').length,
    cancelled: reservations.filter(r => r.status === 'cancelled').length,
    completed: reservations.filter(r => r.status === 'completed').length,
    total_calls: convs.filter(c => c.channel === 'phone').length,
    booked_from_calls: convs.filter(c => c.outcome === 'booked').length,
  }

  return NextResponse.json({ stats, recentReservations: reservations.slice(0, 10) })
}
```

- [ ] **Step 2: Update Step2Services → Step2RoomTypes**

Replace `src/components/onboarding/steps/Step2Services.tsx` entirely:

```typescript
'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Plus, Trash2 } from 'lucide-react'

interface RoomType {
  name: string
  capacity: number
  price_per_night: number
}

interface Props {
  roomTypes: RoomType[]
  onChange: (roomTypes: RoomType[]) => void
}

export function Step2RoomTypes({ roomTypes, onChange }: Props) {
  function addRoomType() {
    onChange([...roomTypes, { name: '', capacity: 2, price_per_night: 0 }])
  }

  function removeRoomType(index: number) {
    onChange(roomTypes.filter((_, i) => i !== index))
  }

  function updateRoomType(index: number, field: keyof RoomType, value: string) {
    const updated = roomTypes.map((rt, i) => {
      if (i !== index) return rt
      if (field === 'name') return { ...rt, name: value }
      return { ...rt, [field]: Number(value) }
    })
    onChange(updated)
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Добавете типовете стаи, които предлагате. AI ще ги предлага при резервации.
      </p>

      {roomTypes.length > 0 && (
        <div className="space-y-3">
          <div className="grid grid-cols-12 gap-2 text-xs font-medium text-muted-foreground">
            <div className="col-span-5">Тип стая</div>
            <div className="col-span-3">Капацитет</div>
            <div className="col-span-3">Цена/нощ (лв)</div>
            <div className="col-span-1" />
          </div>
          {roomTypes.map((rt, i) => (
            <div key={i} className="grid grid-cols-12 gap-2 items-center">
              <div className="col-span-5">
                <Input
                  value={rt.name}
                  onChange={e => updateRoomType(i, 'name', e.target.value)}
                  placeholder="Стандартна, Делукс..."
                />
              </div>
              <div className="col-span-3">
                <Input
                  type="number"
                  value={rt.capacity}
                  onChange={e => updateRoomType(i, 'capacity', e.target.value)}
                  min={1}
                />
              </div>
              <div className="col-span-3">
                <Input
                  type="number"
                  value={rt.price_per_night}
                  onChange={e => updateRoomType(i, 'price_per_night', e.target.value)}
                  min={0}
                />
              </div>
              <div className="col-span-1">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removeRoomType(i)}
                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Button variant="outline" size="sm" onClick={addRoomType} className="gap-2">
        <Plus className="h-4 w-4" />
        Добави тип стая
      </Button>
    </div>
  )
}
```

Also update any file that imports `Step2Services` to import `Step2RoomTypes` instead. Search for the import in the onboarding wizard:

```bash
grep -r "Step2Services" src/
```

Update the import and component usage in the onboarding wizard file found.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/analytics/route.ts src/components/onboarding/steps/Step2Services.tsx
git commit -m "feat: update analytics route + Step2Services→Step2RoomTypes for hotel onboarding"
```
