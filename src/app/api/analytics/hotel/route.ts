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

  let query = supabase
    .from('reservations')
    .select('id, check_in_date, check_out_date, status, room_type_id, created_at')
    .eq('tenant_id', tenant.id)
    .gte('check_in_date', from)
    .lte('check_in_date', to)

  if (roomTypeId) query = query.eq('room_type_id', roomTypeId)
  if (status) query = query.eq('status', status)

  const { data: reservations } = await query

  const { data: roomTypes } = await supabase
    .from('room_types')
    .select('id, name, price_per_night')
    .eq('tenant_id', tenant.id)

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

  const confirmed = (reservations || []).filter(r => r.status === 'confirmed' || r.status === 'completed')

  function calcRevenue(r: { room_type_id: string; check_in_date: string; check_out_date: string | null }) {
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

  const revenueByDay: Record<string, number> = {}
  for (const r of confirmed) {
    const day = r.check_in_date.slice(0, 10)
    revenueByDay[day] = (revenueByDay[day] || 0) + calcRevenue(r)
  }

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

  const statusCounts: Record<string, number> = {}
  for (const r of reservations || []) {
    statusCounts[r.status] = (statusCounts[r.status] || 0) + 1
  }

  const occupancyByDow: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 }
  for (const r of confirmed) {
    const dow = new Date(r.check_in_date).getDay()
    occupancyByDow[dow]++
  }

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
