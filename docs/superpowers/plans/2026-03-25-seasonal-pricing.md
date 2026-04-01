# Seasonal Pricing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add seasonal pricing to room types — multiple named date ranges per room type, each with its own price per night, falling back to the base price when no season matches.

**Architecture:** New `seasonal_pricing` table in Supabase stores per-room-type date ranges with prices. `availability.ts` gains a `getSeasonalPrice(seasons, date, basePrice)` helper that picks the right price per night, enabling proportional calculation across season boundaries. A new API route handles CRUD, and a new UI tab in the Rooms page manages seasons.

**Tech Stack:** Next.js API routes, Supabase (PostgreSQL), TypeScript, React, shadcn/ui

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `supabase/migrations/003_seasonal_pricing.sql` | Create | DB table + indexes + RLS |
| `src/types/database.ts` | Modify | Add `SeasonalPricingRow`, `SeasonalPricingInsert`, update `Database` type |
| `src/lib/availability.ts` | Modify | Add `getSeasonalPrice()`, update `getAvailableRoomTypes()` and `formatAvailabilityBg()` |
| `src/app/api/seasonal-pricing/route.ts` | Create | GET + POST seasonal pricing records |
| `src/app/api/seasonal-pricing/[id]/route.ts` | Create | PATCH + DELETE single record |
| `src/components/rooms/SeasonalPricingTab.tsx` | Create | UI tab for managing seasons per room type |
| `src/app/(dashboard)/rooms/page.tsx` | Modify | Add third tab "Сезонни цени" |

---

## Task 1: Database Migration

**Files:**
- Create: `supabase/migrations/003_seasonal_pricing.sql`

- [ ] **Step 1: Write the migration file**

```sql
-- supabase/migrations/003_seasonal_pricing.sql
create table seasonal_pricing (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid references tenants(id) on delete cascade not null,
  room_type_id uuid references room_types(id) on delete cascade not null,
  label text not null,
  start_date date not null,
  end_date date not null,
  price_per_night numeric(10,2) not null check (price_per_night >= 0),
  created_at timestamptz default now(),
  constraint seasonal_pricing_dates_check check (end_date >= start_date)
);

create index idx_seasonal_pricing_tenant on seasonal_pricing(tenant_id);
create index idx_seasonal_pricing_room_type on seasonal_pricing(room_type_id);

alter table seasonal_pricing enable row level security;

create policy "Tenant members can manage seasonal pricing"
  on seasonal_pricing
  for all
  using (
    tenant_id in (
      select id from tenants where owner_id = auth.uid()
    )
  );
```

- [ ] **Step 2: Run in Supabase SQL editor**

Open Supabase Dashboard → SQL Editor → paste and run the migration.
Expected: `Success. No rows returned.`

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/003_seasonal_pricing.sql
git commit -m "feat: add seasonal_pricing table migration"
```

---

## Task 2: TypeScript Types

**Files:**
- Modify: `src/types/database.ts`

- [ ] **Step 1: Add `SeasonalPricingRow` and `SeasonalPricingInsert` after `RoomTypeRow`**

```typescript
export type SeasonalPricingRow = {
  id: string
  tenant_id: string
  room_type_id: string
  label: string
  start_date: string  // YYYY-MM-DD
  end_date: string    // YYYY-MM-DD
  price_per_night: number
  created_at: string
}

export type SeasonalPricingInsert = {
  id?: string
  tenant_id: string
  room_type_id: string
  label: string
  start_date: string
  end_date: string
  price_per_night: number
}

export type SeasonalPricingUpdate = Partial<Omit<SeasonalPricingInsert, 'id' | 'tenant_id'>>
```

- [ ] **Step 2: Add `SeasonalPricing` alias and update `Database` type**

Add alias after existing aliases:
```typescript
export type SeasonalPricing = SeasonalPricingRow
```

Add to `Database['public']['Tables']`:
```typescript
seasonal_pricing: { Row: SeasonalPricingRow; Insert: SeasonalPricingInsert; Update: SeasonalPricingUpdate; Relationships: [] }
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```
Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add src/types/database.ts
git commit -m "feat: add SeasonalPricing types"
```

---

## Task 3: Pricing Logic in availability.ts

**Files:**
- Modify: `src/lib/availability.ts`

- [ ] **Step 1: Add `getSeasonalPrice` helper function**

Add after the imports, before `getAvailableRoomTypes`:

```typescript
/**
 * Returns the price per night for a specific date given a list of seasonal pricing records.
 * If multiple seasons match (overlapping), picks the shortest (most specific) one.
 * Falls back to basePrice if no season matches.
 */
export function getSeasonalPrice(
  seasons: Array<{ start_date: string; end_date: string; price_per_night: number }>,
  date: string,  // YYYY-MM-DD
  basePrice: number,
): number {
  const matching = seasons.filter(s => s.start_date <= date && s.end_date >= date)
  if (matching.length === 0) return basePrice

  // Pick most specific (shortest) season
  matching.sort((a, b) => {
    const lenA = new Date(a.end_date).getTime() - new Date(a.start_date).getTime()
    const lenB = new Date(b.end_date).getTime() - new Date(b.start_date).getTime()
    return lenA - lenB
  })
  return matching[0].price_per_night
}

/**
 * Calculates total price for a stay, summing price per night across seasons.
 * checkIn inclusive, checkOut exclusive (standard hotel convention).
 */
export function calculateTotalPrice(
  seasons: Array<{ start_date: string; end_date: string; price_per_night: number }>,
  checkIn: string,   // YYYY-MM-DD
  checkOut: string,  // YYYY-MM-DD
  basePrice: number,
): number {
  const start = new Date(checkIn)
  const end = new Date(checkOut)
  let total = 0
  const cur = new Date(start)
  while (cur < end) {
    const dateStr = cur.toISOString().slice(0, 10)
    total += getSeasonalPrice(seasons, dateStr, basePrice)
    cur.setDate(cur.getDate() + 1)
  }
  return total
}
```

- [ ] **Step 2: Update `getAvailableRoomTypes` to fetch and apply seasonal pricing**

Replace the current function signature and body:

```typescript
export async function getAvailableRoomTypes(
  supabase: SupabaseClient,
  tenantId: string,
  checkIn: string,
  checkOut: string,
): Promise<AvailableRoomType[]> {
  // 1. All room types for this tenant
  const { data: roomTypes } = await supabase
    .from('room_types')
    .select('id, name, description, capacity, price_per_night')
    .eq('tenant_id', tenantId)

  if (!roomTypes || roomTypes.length === 0) return []

  // 2. Seasonal pricing for this tenant
  const { data: seasons } = await supabase
    .from('seasonal_pricing')
    .select('room_type_id, start_date, end_date, price_per_night')
    .eq('tenant_id', tenantId)

  const seasonsByType: Record<string, Array<{ start_date: string; end_date: string; price_per_night: number }>> = {}
  for (const s of seasons || []) {
    if (!seasonsByType[s.room_type_id]) seasonsByType[s.room_type_id] = []
    seasonsByType[s.room_type_id].push(s)
  }

  // 3. Physical rooms per type
  const { data: rooms } = await supabase
    .from('rooms')
    .select('id, room_type_id')
    .eq('tenant_id', tenantId)
    .not('status', 'eq', 'maintenance')

  const roomCountByType: Record<string, number> = {}
  for (const room of rooms || []) {
    roomCountByType[room.room_type_id] = (roomCountByType[room.room_type_id] || 0) + 1
  }

  // 4. Overlapping confirmed reservations per room type
  const { data: overlapping } = await supabase
    .from('reservations')
    .select('room_type_id')
    .eq('tenant_id', tenantId)
    .in('status', ['confirmed'])
    .lt('check_in_date', checkOut)
    .or(`check_out_date.is.null,check_out_date.gt.${checkIn}`)

  const bookedByType: Record<string, number> = {}
  for (const res of overlapping || []) {
    if (res.room_type_id) {
      bookedByType[res.room_type_id] = (bookedByType[res.room_type_id] || 0) + 1
    }
  }

  // 5. Calculate availability + effective price
  const available: AvailableRoomType[] = []
  for (const rt of roomTypes) {
    const total = roomCountByType[rt.id] ?? 1
    const booked = bookedByType[rt.id] ?? 0
    const free = total - booked
    if (free > 0) {
      const rtSeasons = seasonsByType[rt.id] || []
      // Show price for check-in night as representative price
      const effectivePrice = getSeasonalPrice(rtSeasons, checkIn, rt.price_per_night)
      available.push({
        id: rt.id,
        name: rt.name,
        description: rt.description,
        capacity: rt.capacity,
        price_per_night: effectivePrice,
        total_rooms: total,
        available_rooms: free,
      })
    }
  }

  return available
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```
Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add src/lib/availability.ts
git commit -m "feat: seasonal price logic in availability.ts"
```

---

## Task 4: API Routes for Seasonal Pricing

**Files:**
- Create: `src/app/api/seasonal-pricing/route.ts`
- Create: `src/app/api/seasonal-pricing/[id]/route.ts`

- [ ] **Step 1: Create `route.ts` (GET all + POST new)**

```typescript
// src/app/api/seasonal-pricing/route.ts
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: tenant } = await supabase
    .from('tenants')
    .select('id')
    .eq('owner_id', user.id)
    .single()
  if (!tenant) return NextResponse.json({ error: 'No tenant' }, { status: 404 })

  const { searchParams } = new URL(req.url)
  const roomTypeId = searchParams.get('room_type_id')

  let query = supabase
    .from('seasonal_pricing')
    .select('*')
    .eq('tenant_id', tenant.id)
    .order('start_date', { ascending: true })

  if (roomTypeId) query = query.eq('room_type_id', roomTypeId)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(data)
}

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: tenant } = await supabase
    .from('tenants')
    .select('id')
    .eq('owner_id', user.id)
    .single()
  if (!tenant) return NextResponse.json({ error: 'No tenant' }, { status: 404 })

  const body = await req.json()
  const { room_type_id, label, start_date, end_date, price_per_night } = body

  if (!room_type_id || !label || !start_date || !end_date || price_per_night == null) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }
  if (end_date < start_date) {
    return NextResponse.json({ error: 'end_date must be >= start_date' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('seasonal_pricing')
    .insert({ tenant_id: tenant.id, room_type_id, label, start_date, end_date, price_per_night })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
```

- [ ] **Step 2: Create `[id]/route.ts` (PATCH + DELETE)**

```typescript
// src/app/api/seasonal-pricing/[id]/route.ts
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { label, start_date, end_date, price_per_night } = body

  if (end_date && start_date && end_date < start_date) {
    return NextResponse.json({ error: 'end_date must be >= start_date' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('seasonal_pricing')
    .update({ label, start_date, end_date, price_per_night })
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { error } = await supabase
    .from('seasonal_pricing')
    .delete()
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return new NextResponse(null, { status: 204 })
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/app/api/seasonal-pricing/
git commit -m "feat: seasonal pricing API routes"
```

---

## Task 5: SeasonalPricingTab UI Component

**Files:**
- Create: `src/components/rooms/SeasonalPricingTab.tsx`

- [ ] **Step 1: Create the component**

```typescript
// src/components/rooms/SeasonalPricingTab.tsx
'use client'
import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import type { RoomTypeRow, SeasonalPricingRow } from '@/types/database'

interface Props {
  roomTypes: RoomTypeRow[]
}

const EMPTY_FORM = { label: '', start_date: '', end_date: '', price_per_night: '' }

export function SeasonalPricingTab({ roomTypes }: Props) {
  const [selectedTypeId, setSelectedTypeId] = useState<string>('')
  const [seasons, setSeasons] = useState<SeasonalPricingRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [editTarget, setEditTarget] = useState<SeasonalPricingRow | null>(null)
  const [editForm, setEditForm] = useState(EMPTY_FORM)

  // Default select first room type
  useEffect(() => {
    if (roomTypes.length > 0 && !selectedTypeId) {
      setSelectedTypeId(roomTypes[0].id)
    }
  }, [roomTypes, selectedTypeId])

  const fetchSeasons = useCallback(async (roomTypeId: string) => {
    if (!roomTypeId) return
    setLoading(true)
    const res = await fetch(`/api/seasonal-pricing?room_type_id=${roomTypeId}`)
    setLoading(false)
    if (!res.ok) return
    setSeasons(await res.json())
  }, [])

  useEffect(() => {
    if (selectedTypeId) fetchSeasons(selectedTypeId)
  }, [selectedTypeId, fetchSeasons])

  const handleAdd = async () => {
    setSaving(true)
    setError(null)
    const res = await fetch('/api/seasonal-pricing', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        room_type_id: selectedTypeId,
        label: form.label,
        start_date: form.start_date,
        end_date: form.end_date,
        price_per_night: parseFloat(form.price_per_night),
      }),
    })
    setSaving(false)
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setError(data.error || 'Грешка при запазване')
      return
    }
    setAddOpen(false)
    setForm(EMPTY_FORM)
    fetchSeasons(selectedTypeId)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Изтрий този сезон?')) return
    const res = await fetch(`/api/seasonal-pricing/${id}`, { method: 'DELETE' })
    if (!res.ok) { setError('Грешка при изтриване'); return }
    fetchSeasons(selectedTypeId)
  }

  const openEdit = (s: SeasonalPricingRow) => {
    setEditTarget(s)
    setEditForm({
      label: s.label,
      start_date: s.start_date,
      end_date: s.end_date,
      price_per_night: String(s.price_per_night),
    })
  }

  const handleEdit = async () => {
    if (!editTarget) return
    setSaving(true)
    setError(null)
    const res = await fetch(`/api/seasonal-pricing/${editTarget.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        label: editForm.label,
        start_date: editForm.start_date,
        end_date: editForm.end_date,
        price_per_night: parseFloat(editForm.price_per_night),
      }),
    })
    setSaving(false)
    if (!res.ok) { setError('Грешка при редактиране'); return }
    setEditTarget(null)
    fetchSeasons(selectedTypeId)
  }

  const selectedType = roomTypes.find(rt => rt.id === selectedTypeId)

  return (
    <div className="space-y-4">
      {error && <p className="text-sm text-red-400">{error}</p>}

      {roomTypes.length === 0 ? (
        <p className="text-muted-foreground text-sm text-center py-12">
          Първо добавете типове стаи.
        </p>
      ) : (
        <>
          {/* Room type selector */}
          <div className="flex flex-wrap gap-2">
            {roomTypes.map(rt => (
              <button
                key={rt.id}
                onClick={() => setSelectedTypeId(rt.id)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  selectedTypeId === rt.id
                    ? 'bg-primary text-primary-foreground'
                    : 'border border-border text-muted-foreground hover:text-foreground'
                }`}
              >
                {rt.name}
              </button>
            ))}
          </div>

          {/* Base price note */}
          {selectedType && (
            <div className="flex items-center justify-between rounded-md border border-border px-4 py-2 bg-muted/30">
              <span className="text-sm text-muted-foreground">Базова цена (извън сезоните)</span>
              <span className="font-semibold text-sm">{selectedType.price_per_night} лв / нощ</span>
            </div>
          )}

          {/* Add button */}
          <div className="flex justify-end">
            <Button size="sm" onClick={() => setAddOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />Добави сезон
            </Button>
          </div>

          {/* Seasons list */}
          {loading ? (
            <p className="text-sm text-muted-foreground">Зареждане...</p>
          ) : seasons.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Няма сезонни цени. Добавете първия сезон.
            </p>
          ) : (
            <div className="space-y-2">
              {seasons.map(s => (
                <Card key={s.id} className="border-border">
                  <CardContent className="flex items-center gap-3 py-3 px-4">
                    <div className="flex-1">
                      <p className="font-medium text-sm">{s.label}</p>
                      <p className="text-xs text-muted-foreground">
                        {s.start_date} – {s.end_date}
                      </p>
                    </div>
                    <span className="font-bold text-primary">{s.price_per_night} лв/нощ</span>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(s)}>
                      <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDelete(s.id)}>
                      <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      {/* Add dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Нов сезон</DialogTitle></DialogHeader>
          <SeasonForm form={form} setForm={setForm} saving={saving} onSave={handleAdd} />
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={!!editTarget} onOpenChange={open => { if (!open) setEditTarget(null) }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Редактирай сезон</DialogTitle></DialogHeader>
          <SeasonForm form={editForm} setForm={setEditForm} saving={saving} onSave={handleEdit} />
        </DialogContent>
      </Dialog>
    </div>
  )
}

function SeasonForm({
  form,
  setForm,
  saving,
  onSave,
}: {
  form: typeof EMPTY_FORM
  setForm: (f: typeof EMPTY_FORM) => void
  saving: boolean
  onSave: () => void
}) {
  const valid = form.label && form.start_date && form.end_date && form.price_per_night && form.end_date >= form.start_date
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Наименование *</Label>
        <Input value={form.label} onChange={e => setForm({ ...form, label: e.target.value })} placeholder="Летен сезон, Зимни празници..." />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>От дата *</Label>
          <Input type="date" value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })} />
        </div>
        <div className="space-y-2">
          <Label>До дата *</Label>
          <Input type="date" value={form.end_date} onChange={e => setForm({ ...form, end_date: e.target.value })} />
        </div>
      </div>
      <div className="space-y-2">
        <Label>Цена/нощ (лв) *</Label>
        <Input type="number" min="0" step="0.01" value={form.price_per_night} onChange={e => setForm({ ...form, price_per_night: e.target.value })} placeholder="120.00" />
      </div>
      <Button onClick={onSave} disabled={saving || !valid} className="w-full">
        {saving ? 'Запазване...' : 'Запази'}
      </Button>
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/components/rooms/SeasonalPricingTab.tsx
git commit -m "feat: SeasonalPricingTab component"
```

---

## Task 6: Wire Tab into Rooms Page

**Files:**
- Modify: `src/app/(dashboard)/rooms/page.tsx`

- [ ] **Step 1: Add import and third tab**

Add import at top:
```typescript
import { SeasonalPricingTab } from '@/components/rooms/SeasonalPricingTab'
```

Update `<TabsList>` and add `<TabsContent>`:
```tsx
<TabsList>
  <TabsTrigger value="types">Типове стаи</TabsTrigger>
  <TabsTrigger value="rooms">Стаи</TabsTrigger>
  <TabsTrigger value="seasonal">Сезонни цени</TabsTrigger>
</TabsList>
<TabsContent value="types" className="mt-4">
  <RoomTypesTab roomTypes={roomTypes} onRefresh={fetchRooms} />
</TabsContent>
<TabsContent value="rooms" className="mt-4">
  <RoomsTab rooms={rooms} roomTypes={roomTypes} onRefresh={fetchRooms} />
</TabsContent>
<TabsContent value="seasonal" className="mt-4">
  <SeasonalPricingTab roomTypes={roomTypes} />
</TabsContent>
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Test in browser**

Navigate to `/rooms` → click "Сезонни цени" tab → add a season → verify it appears.

- [ ] **Step 4: Commit**

```bash
git add src/app/(dashboard)/rooms/page.tsx
git commit -m "feat: add Сезонни цени tab to Rooms page"
```

---

## Done ✓

All tasks complete. Seasonal pricing is now:
- Stored in DB per room type
- Applied proportionally per night in availability checks
- Manageable via the Rooms → Сезонни цени tab
- Visible to the AI assistant through the existing availability tools
