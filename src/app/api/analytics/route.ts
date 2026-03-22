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
