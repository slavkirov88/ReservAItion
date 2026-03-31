# BI Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a BI analytics dashboard for hotel owners (`/analytics`) and a separate admin dashboard (`/admin/analytics`) with Gradient Modern visual style, Recharts charts, and filters by period/room type/status.

**Architecture:** Two new pages — `/analytics` (per-tenant, server component) and `/admin/analytics` (admin-only, server component). Two new API routes serve aggregated data. Recharts renders line, bar, donut, and heatmap charts. Revenue is calculated as `room_type.price_per_night × nights` (with seasonal pricing applied via existing `getSeasonalPrice` helper).

**Tech Stack:** Next.js 16 App Router, Supabase PostgreSQL, Recharts, TypeScript, Tailwind + shadcn/ui, date-fns

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `package.json` | Modify | Add recharts |
| `src/app/api/analytics/hotel/route.ts` | Create | Hotel-level aggregated metrics |
| `src/app/api/analytics/admin/route.ts` | Create | Admin-level aggregated metrics |
| `src/components/analytics/KpiCard.tsx` | Create | Reusable KPI metric card |
| `src/components/analytics/RevenueChart.tsx` | Create | Line chart: revenue over time |
| `src/components/analytics/ReservationsByTypeChart.tsx` | Create | Bar chart: reservations by room type |
| `src/components/analytics/StatusDonutChart.tsx` | Create | Donut chart: status breakdown |
| `src/components/analytics/OccupancyHeatmap.tsx` | Create | Heatmap: occupancy by day of week |
| `src/components/analytics/FiltersBar.tsx` | Create | Period + room type + status filter controls |
| `src/app/(dashboard)/analytics/page.tsx` | Create | Hotel BI page |
| `src/app/(dashboard)/admin/analytics/page.tsx` | Create | Admin BI page |
| `src/components/layout/AppSidebar.tsx` | Modify | Add Analytics nav link |

---

## Task 1: Install Recharts

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install recharts**

```bash
npm install recharts
```

Expected: `added N packages`

- [ ] **Step 2: Verify import works**

```bash
node -e "require('recharts')" && echo OK
```

Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "feat: add recharts for BI dashboard"
```

---

## Task 2: Hotel Analytics API Route

**Files:**
- Create: `src/app/api/analytics/hotel/route.ts`

This route returns all metrics needed for the hotel BI page in a single call.

- [ ] **Step 1: Create the route**

```typescript
// src/app/api/analytics/hotel/route.ts
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSeasonalPrice } from '@/lib/availability'

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
  const from = searchParams.get('from') || getDefaultFrom()
  const to = searchParams.get('to') || new Date().toISOString().slice(0, 10)
  const roomTypeId = searchParams.get('room_type_id') || null
  const status = searchParams.get('status') || null

  // Fetch reservations in range
  let query = supabase
    .from('reservations')
    .select('id, check_in_date, check_out_date, status, room_type_id, created_at')
    .eq('tenant_id', tenant.id)
    .gte('check_in_date', from)
    .lte('check_in_date', to)

  if (roomTypeId) query = query.eq('room_type_id', roomTypeId)
  if (status) query = query.eq('status', status)

  const { data: reservations } = await query

  // Fetch room types for price calculation
  const { data: roomTypes } = await supabase
    .from('room_types')
    .select('id, name, price_per_night')
    .eq('tenant_id', tenant.id)

  // Fetch seasonal pricing
  const { data: seasons } = await supabase
    .from('seasonal_pricing')
    .select('room_type_id, start_date, end_date, price_per_night')
    .eq('tenant_id', tenant.id)

  const seasonsByType: Record<string, Array<{ start_date: string; end_date: string; price_per_night: number }>> = {}
  for (const s of seasons || []) {
    if (!seasonsByType[s.room_type_id]) seasonsByType[s.room_type_id] = []
    seasonsByType[s.room_type_id].push(s)
  }

  const rtMap = Object.fromEntries((roomTypes || []).map(rt => [rt.id, rt]))

  // Calculate revenue per reservation
  const confirmed = (reservations || []).filter(r => r.status === 'confirmed' || r.status === 'completed')

  function calcRevenue(r: { room_type_id: string; check_in_date: string; check_out_date: string }) {
    const rt = rtMap[r.room_type_id]
    if (!rt || !r.check_out_date) return 0
    const rtSeasons = seasonsByType[r.room_type_id] || []
    const start = new Date(r.check_in_date)
    const end = new Date(r.check_out_date)
    let total = 0
    const cur = new Date(start)
    while (cur < end) {
      const dateStr = cur.toISOString().slice(0, 10)
      total += getSeasonalPrice(rtSeasons, dateStr, rt.price_per_night)
      cur.setDate(cur.getDate() + 1)
    }
    return total
  }

  const totalRevenue = confirmed.reduce((sum, r) => sum + calcRevenue(r), 0)
  const totalReservations = (reservations || []).length
  const cancelledCount = (reservations || []).filter(r => r.status === 'cancelled').length

  // Revenue by day (for line chart)
  const revenueByDay: Record<string, number> = {}
  for (const r of confirmed) {
    const day = r.check_in_date.slice(0, 10)
    revenueByDay[day] = (revenueByDay[day] || 0) + calcRevenue(r)
  }

  // Reservations by room type (for bar chart)
  const byType: Record<string, { name: string; count: number; revenue: number }> = {}
  for (const r of reservations || []) {
    const rt = rtMap[r.room_type_id]
    if (!rt) continue
    if (!byType[r.room_type_id]) byType[r.room_type_id] = { name: rt.name, count: 0, revenue: 0 }
    byType[r.room_type_id].count++
    if (r.status === 'confirmed' || r.status === 'completed') {
      byType[r.room_type_id].revenue += calcRevenue(r)
    }
  }

  // Status breakdown (for donut)
  const statusCounts: Record<string, number> = {}
  for (const r of reservations || []) {
    statusCounts[r.status] = (statusCounts[r.status] || 0) + 1
  }

  // Occupancy by day of week (0=Sun, 6=Sat)
  const occupancyByDow: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 }
  for (const r of confirmed) {
    const dow = new Date(r.check_in_date).getDay()
    occupancyByDow[dow]++
  }

  // Fetch room types for filter options
  const filterOptions = (roomTypes || []).map(rt => ({ id: rt.id, name: rt.name }))

  return NextResponse.json({
    summary: {
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      totalReservations,
      cancelledCount,
      cancelRate: totalReservations > 0 ? Math.round((cancelledCount / totalReservations) * 100) : 0,
    },
    revenueByDay: Object.entries(revenueByDay)
      .map(([date, revenue]) => ({ date, revenue: Math.round(revenue * 100) / 100 }))
      .sort((a, b) => a.date.localeCompare(b.date)),
    byRoomType: Object.values(byType),
    statusBreakdown: Object.entries(statusCounts).map(([status, count]) => ({ status, count })),
    occupancyByDow: Object.entries(occupancyByDow).map(([dow, count]) => ({
      dow: ['Нед', 'Пон', 'Вт', 'Ср', 'Чет', 'Пет', 'Съб'][Number(dow)],
      count,
    })),
    filterOptions,
  })
}

function getDefaultFrom() {
  const d = new Date()
  d.setDate(d.getDate() - 30)
  return d.toISOString().slice(0, 10)
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/analytics/hotel/route.ts
git commit -m "feat: hotel analytics API route"
```

---

## Task 3: Admin Analytics API Route

**Files:**
- Create: `src/app/api/analytics/admin/route.ts`

- [ ] **Step 1: Create the route**

```typescript
// src/app/api/analytics/admin/route.ts
import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || ''

export async function GET(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email !== ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Use service role for cross-tenant queries
  const service = await createServiceClient()

  const [tenantsRes, reservationsRes] = await Promise.all([
    service.from('tenants').select('id, name, created_at'),
    service.from('reservations').select('id, tenant_id, status, created_at, check_in_date'),
  ])

  const tenants = tenantsRes.data || []
  const reservations = reservationsRes.data || []

  // Active tenants count
  const activeTenantCount = tenants.length

  // New tenants by month
  const tenantsByMonth: Record<string, number> = {}
  for (const t of tenants) {
    const month = t.created_at.slice(0, 7)
    tenantsByMonth[month] = (tenantsByMonth[month] || 0) + 1
  }

  // Total reservations
  const totalReservations = reservations.length
  const confirmedReservations = reservations.filter(r => r.status === 'confirmed' || r.status === 'completed').length

  // Reservations by month
  const reservationsByMonth: Record<string, number> = {}
  for (const r of reservations) {
    const month = r.check_in_date?.slice(0, 7) || r.created_at.slice(0, 7)
    reservationsByMonth[month] = (reservationsByMonth[month] || 0) + 1
  }

  // Reservations by tenant (top 10)
  const byTenant: Record<string, { name: string; count: number }> = {}
  const tenantMap = Object.fromEntries(tenants.map(t => [t.id, t.name || 'Unnamed']))
  for (const r of reservations) {
    if (!byTenant[r.tenant_id]) byTenant[r.tenant_id] = { name: tenantMap[r.tenant_id] || r.tenant_id, count: 0 }
    byTenant[r.tenant_id].count++
  }
  const topTenants = Object.values(byTenant)
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)

  return NextResponse.json({
    summary: {
      activeTenantCount,
      totalReservations,
      confirmedReservations,
    },
    tenantsByMonth: Object.entries(tenantsByMonth)
      .map(([month, count]) => ({ month, count }))
      .sort((a, b) => a.month.localeCompare(b.month)),
    reservationsByMonth: Object.entries(reservationsByMonth)
      .map(([month, count]) => ({ month, count }))
      .sort((a, b) => a.month.localeCompare(b.month)),
    topTenants,
  })
}
```

- [ ] **Step 2: Add `ADMIN_EMAIL` to env**

Add to `.env.local`:
```
ADMIN_EMAIL=your@email.com
```
And add to Vercel environment variables.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/analytics/admin/route.ts
git commit -m "feat: admin analytics API route"
```

---

## Task 4: Shared Analytics Components

**Files:**
- Create: `src/components/analytics/KpiCard.tsx`
- Create: `src/components/analytics/FiltersBar.tsx`

- [ ] **Step 1: Create KpiCard**

```typescript
// src/components/analytics/KpiCard.tsx
interface KpiCardProps {
  label: string
  value: string
  trend?: number  // percent, positive = good
  icon?: string
  gradient?: string
}

export function KpiCard({ label, value, trend, icon, gradient = 'from-indigo-950 to-indigo-900' }: KpiCardProps) {
  return (
    <div className={`rounded-2xl border border-indigo-800/40 bg-gradient-to-br ${gradient} p-5`}>
      <div className="flex items-start justify-between mb-3">
        <span className="text-xs text-indigo-300/70 font-semibold uppercase tracking-wider">{label}</span>
        {icon && <span className="text-xl">{icon}</span>}
      </div>
      <div className="text-3xl font-black text-white mb-1">{value}</div>
      {trend !== undefined && (
        <div className={`text-xs font-semibold ${trend >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
          {trend >= 0 ? '▲' : '▼'} {Math.abs(trend)}% vs предходен период
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Create FiltersBar**

```typescript
// src/components/analytics/FiltersBar.tsx
'use client'

export type Period = '7d' | '30d' | '90d' | '365d'

interface FiltersBarProps {
  period: Period
  onPeriodChange: (p: Period) => void
  roomTypeId: string
  onRoomTypeChange: (id: string) => void
  status: string
  onStatusChange: (s: string) => void
  roomTypes: Array<{ id: string; name: string }>
}

const PERIODS: Array<{ value: Period; label: string }> = [
  { value: '7d', label: '7 дни' },
  { value: '30d', label: '30 дни' },
  { value: '90d', label: '90 дни' },
  { value: '365d', label: '1 година' },
]

const STATUSES = [
  { value: '', label: 'Всички статуси' },
  { value: 'confirmed', label: 'Потвърдени' },
  { value: 'cancelled', label: 'Отказани' },
  { value: 'completed', label: 'Завършени' },
  { value: 'pending', label: 'Чакащи' },
]

export function FiltersBar({ period, onPeriodChange, roomTypeId, onRoomTypeChange, status, onStatusChange, roomTypes }: FiltersBarProps) {
  return (
    <div className="flex flex-wrap gap-3 items-center">
      {/* Period toggle */}
      <div className="flex rounded-xl border border-border overflow-hidden">
        {PERIODS.map(p => (
          <button
            key={p.value}
            onClick={() => onPeriodChange(p.value)}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              period === p.value
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Room type select */}
      <select
        value={roomTypeId}
        onChange={e => onRoomTypeChange(e.target.value)}
        className="px-3 py-2 text-sm rounded-xl border border-border bg-background text-foreground"
      >
        <option value="">Всички типове</option>
        {roomTypes.map(rt => (
          <option key={rt.id} value={rt.id}>{rt.name}</option>
        ))}
      </select>

      {/* Status select */}
      <select
        value={status}
        onChange={e => onStatusChange(e.target.value)}
        className="px-3 py-2 text-sm rounded-xl border border-border bg-background text-foreground"
      >
        {STATUSES.map(s => (
          <option key={s.value} value={s.value}>{s.label}</option>
        ))}
      </select>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/analytics/
git commit -m "feat: KpiCard and FiltersBar analytics components"
```

---

## Task 5: Chart Components

**Files:**
- Create: `src/components/analytics/RevenueChart.tsx`
- Create: `src/components/analytics/ReservationsByTypeChart.tsx`
- Create: `src/components/analytics/StatusDonutChart.tsx`
- Create: `src/components/analytics/OccupancyHeatmap.tsx`

- [ ] **Step 1: Create RevenueChart**

```typescript
// src/components/analytics/RevenueChart.tsx
'use client'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

interface Props {
  data: Array<{ date: string; revenue: number }>
}

export function RevenueChart({ data }: Props) {
  return (
    <div className="rounded-2xl border border-indigo-800/40 bg-gradient-to-br from-indigo-950/60 to-slate-900/60 p-5">
      <h3 className="text-sm font-semibold text-indigo-300/70 uppercase tracking-wider mb-4">Приходи по дни</h3>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#312e81" />
          <XAxis dataKey="date" tick={{ fill: '#a5b4fc', fontSize: 11 }} tickFormatter={d => d.slice(5)} />
          <YAxis tick={{ fill: '#a5b4fc', fontSize: 11 }} tickFormatter={v => `€${v}`} />
          <Tooltip
            contentStyle={{ background: '#1e1b4b', border: '1px solid #4338ca', borderRadius: 8 }}
            labelStyle={{ color: '#a5b4fc' }}
            formatter={(v: number) => [`€${v.toFixed(2)}`, 'Приходи']}
          />
          <Line type="monotone" dataKey="revenue" stroke="#818cf8" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
```

- [ ] **Step 2: Create ReservationsByTypeChart**

```typescript
// src/components/analytics/ReservationsByTypeChart.tsx
'use client'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

interface Props {
  data: Array<{ name: string; count: number; revenue: number }>
}

export function ReservationsByTypeChart({ data }: Props) {
  return (
    <div className="rounded-2xl border border-cyan-800/40 bg-gradient-to-br from-cyan-950/60 to-slate-900/60 p-5">
      <h3 className="text-sm font-semibold text-cyan-300/70 uppercase tracking-wider mb-4">Резервации по тип стая</h3>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#164e63" />
          <XAxis dataKey="name" tick={{ fill: '#a5f3fc', fontSize: 11 }} />
          <YAxis tick={{ fill: '#a5f3fc', fontSize: 11 }} />
          <Tooltip
            contentStyle={{ background: '#0c2340', border: '1px solid #0891b2', borderRadius: 8 }}
            labelStyle={{ color: '#a5f3fc' }}
          />
          <Bar dataKey="count" fill="#0891b2" radius={[4, 4, 0, 0]} name="Резервации" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
```

- [ ] **Step 3: Create StatusDonutChart**

```typescript
// src/components/analytics/StatusDonutChart.tsx
'use client'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts'

interface Props {
  data: Array<{ status: string; count: number }>
}

const COLORS: Record<string, string> = {
  confirmed: '#4ade80',
  completed: '#34d399',
  cancelled: '#f87171',
  pending: '#fbbf24',
  no_show: '#94a3b8',
}

const LABELS: Record<string, string> = {
  confirmed: 'Потвърдени',
  completed: 'Завършени',
  cancelled: 'Отказани',
  pending: 'Чакащи',
  no_show: 'No show',
}

export function StatusDonutChart({ data }: Props) {
  const chartData = data.map(d => ({ name: LABELS[d.status] || d.status, value: d.count, status: d.status }))
  return (
    <div className="rounded-2xl border border-violet-800/40 bg-gradient-to-br from-violet-950/60 to-slate-900/60 p-5">
      <h3 className="text-sm font-semibold text-violet-300/70 uppercase tracking-wider mb-4">По статус</h3>
      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <Pie data={chartData} dataKey="value" cx="50%" cy="50%" innerRadius={55} outerRadius={80}>
            {chartData.map((entry, i) => (
              <Cell key={i} fill={COLORS[entry.status] || '#6366f1'} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{ background: '#1e1b4b', border: '1px solid #7c3aed', borderRadius: 8 }}
          />
          <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, color: '#c4b5fd' }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}
```

- [ ] **Step 4: Create OccupancyHeatmap**

```typescript
// src/components/analytics/OccupancyHeatmap.tsx
'use client'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'

interface Props {
  data: Array<{ dow: string; count: number }>
}

export function OccupancyHeatmap({ data }: Props) {
  const max = Math.max(...data.map(d => d.count), 1)
  return (
    <div className="rounded-2xl border border-emerald-800/40 bg-gradient-to-br from-emerald-950/60 to-slate-900/60 p-5">
      <h3 className="text-sm font-semibold text-emerald-300/70 uppercase tracking-wider mb-4">Заетост по ден от седмицата</h3>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data}>
          <XAxis dataKey="dow" tick={{ fill: '#6ee7b7', fontSize: 12 }} />
          <YAxis tick={{ fill: '#6ee7b7', fontSize: 11 }} />
          <Tooltip
            contentStyle={{ background: '#064e3b', border: '1px solid #059669', borderRadius: 8 }}
            labelStyle={{ color: '#6ee7b7' }}
            formatter={(v: number) => [v, 'Резервации']}
          />
          <Bar dataKey="count" radius={[4, 4, 0, 0]}>
            {data.map((entry, i) => (
              <Cell
                key={i}
                fill={`rgba(16, 185, 129, ${0.3 + (entry.count / max) * 0.7})`}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
```

- [ ] **Step 5: Commit**

```bash
git add src/components/analytics/
git commit -m "feat: analytics chart components (line, bar, donut, heatmap)"
```

---

## Task 6: Hotel Analytics Page

**Files:**
- Create: `src/app/(dashboard)/analytics/page.tsx`

- [ ] **Step 1: Create the page**

```typescript
// src/app/(dashboard)/analytics/page.tsx
'use client'
import { useState, useEffect, useCallback } from 'react'
import { KpiCard } from '@/components/analytics/KpiCard'
import { FiltersBar, type Period } from '@/components/analytics/FiltersBar'
import { RevenueChart } from '@/components/analytics/RevenueChart'
import { ReservationsByTypeChart } from '@/components/analytics/ReservationsByTypeChart'
import { StatusDonutChart } from '@/components/analytics/StatusDonutChart'
import { OccupancyHeatmap } from '@/components/analytics/OccupancyHeatmap'

function periodToDates(period: Period): { from: string; to: string } {
  const to = new Date()
  const from = new Date()
  const days = { '7d': 7, '30d': 30, '90d': 90, '365d': 365 }[period]
  from.setDate(from.getDate() - days)
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  }
}

export default function AnalyticsPage() {
  const [period, setPeriod] = useState<Period>('30d')
  const [roomTypeId, setRoomTypeId] = useState('')
  const [status, setStatus] = useState('')
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    setLoading(true)
    const { from, to } = periodToDates(period)
    const params = new URLSearchParams({ from, to })
    if (roomTypeId) params.set('room_type_id', roomTypeId)
    if (status) params.set('status', status)
    const res = await fetch(`/api/analytics/hotel?${params}`)
    if (res.ok) setData(await res.json())
    setLoading(false)
  }, [period, roomTypeId, status])

  useEffect(() => { fetchData() }, [fetchData])

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Анализи</h1>
          <p className="text-muted-foreground text-sm mt-1">Приходи, заетост и резервации</p>
        </div>
      </div>

      <FiltersBar
        period={period}
        onPeriodChange={setPeriod}
        roomTypeId={roomTypeId}
        onRoomTypeChange={setRoomTypeId}
        status={status}
        onStatusChange={setStatus}
        roomTypes={data?.filterOptions || []}
      />

      {loading ? (
        <div className="text-muted-foreground text-sm">Зареждане...</div>
      ) : data ? (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard
              label="Общи приходи"
              value={`€${data.summary.totalRevenue.toLocaleString()}`}
              icon="💰"
              gradient="from-indigo-950 to-indigo-900"
            />
            <KpiCard
              label="Резервации"
              value={String(data.summary.totalReservations)}
              icon="📅"
              gradient="from-cyan-950 to-cyan-900"
            />
            <KpiCard
              label="Отказани"
              value={`${data.summary.cancelRate}%`}
              icon="❌"
              gradient="from-rose-950 to-rose-900"
            />
            <KpiCard
              label="Потвърдени"
              value={String(data.summary.totalReservations - data.summary.cancelledCount)}
              icon="✅"
              gradient="from-emerald-950 to-emerald-900"
            />
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="lg:col-span-2">
              <RevenueChart data={data.revenueByDay} />
            </div>
            <ReservationsByTypeChart data={data.byRoomType} />
            <StatusDonutChart data={data.statusBreakdown} />
            <div className="lg:col-span-2">
              <OccupancyHeatmap data={data.occupancyByDow} />
            </div>
          </div>
        </>
      ) : (
        <div className="text-muted-foreground text-sm">Няма данни</div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/(dashboard)/analytics/
git commit -m "feat: hotel analytics page"
```

---

## Task 7: Admin Analytics Page

**Files:**
- Create: `src/app/(dashboard)/admin/analytics/page.tsx`

- [ ] **Step 1: Create the page**

```typescript
// src/app/(dashboard)/admin/analytics/page.tsx
'use client'
import { useState, useEffect } from 'react'
import { KpiCard } from '@/components/analytics/KpiCard'
import { RevenueChart } from '@/components/analytics/RevenueChart'
import { ReservationsByTypeChart } from '@/components/analytics/ReservationsByTypeChart'

export default function AdminAnalyticsPage() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/analytics/admin')
      .then(r => {
        if (r.status === 403) throw new Error('Нямаш достъп до admin панела')
        return r.json()
      })
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="p-6 text-muted-foreground">Зареждане...</div>
  if (error) return <div className="p-6 text-rose-400">{error}</div>

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Admin Анализи</h1>
        <p className="text-muted-foreground text-sm mt-1">Всички хотели в платформата</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KpiCard label="Активни хотели" value={String(data.summary.activeTenantCount)} icon="🏨" gradient="from-indigo-950 to-indigo-900" />
        <KpiCard label="Общо резервации" value={String(data.summary.totalReservations)} icon="📅" gradient="from-cyan-950 to-cyan-900" />
        <KpiCard label="Потвърдени" value={String(data.summary.confirmedReservations)} icon="✅" gradient="from-emerald-950 to-emerald-900" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* New tenants by month — reusing bar chart with count */}
        <ReservationsByTypeChart data={data.tenantsByMonth.map((d: any) => ({ name: d.month, count: d.count, revenue: 0 }))} />
        {/* Top hotels by reservations */}
        <ReservationsByTypeChart data={data.topTenants.map((d: any) => ({ name: d.name, count: d.count, revenue: 0 }))} />
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/(dashboard)/admin/
git commit -m "feat: admin analytics page"
```

---

## Task 8: Add Navigation Link

**Files:**
- Modify: `src/components/layout/AppSidebar.tsx`

- [ ] **Step 1: Add Analytics to sidebar**

Find the nav items array in `AppSidebar.tsx` and add:
```typescript
{ title: 'Анализи', url: '/analytics', icon: BarChart2 }
```

Add `BarChart2` to the existing lucide-react import line (do not add a duplicate import statement):
```typescript
import { ..., BarChart2 } from 'lucide-react'
```

- [ ] **Step 2: Push and deploy**

```bash
git add src/components/layout/AppSidebar.tsx
git commit -m "feat: add Analytics link to sidebar"
git push origin master
```

---

## Done ✓

BI Dashboard е готов:
- `/analytics` — хотелиерът вижда приходи, заетост, резервации по тип, статус breakdown
- `/admin/analytics` — ти виждаш всички хотели, топ клиенти, растеж
- Gradient Modern стил с 4 типа графики (line, bar, donut, heatmap)
- Филтри по период, тип стая и статус
