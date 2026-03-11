import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { startOfWeek, endOfWeek, format } from 'date-fns'
import type { AppointmentRow, ConversationRow } from '@/types/database'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: tenant } = await supabase.from('tenants').select('id').eq('owner_id', user.id).single()
  if (!tenant) return NextResponse.json({ appointments: [], stats: { total: 0, confirmed: 0, cancelled: 0, completed: 0 } })

  const now = new Date()
  const weekStart = format(startOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd')
  const weekEnd = format(endOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd')

  const { data: appointmentsData } = await supabase
    .from('appointments')
    .select('*')
    .eq('tenant_id', tenant.id)
    .gte('starts_at', `${weekStart}T00:00:00`)
    .lte('starts_at', `${weekEnd}T23:59:59`)
    .order('starts_at')

  const { data: conversationsData } = await supabase
    .from('conversations')
    .select('*')
    .eq('tenant_id', tenant.id)
    .gte('created_at', `${weekStart}T00:00:00`)
    .lte('created_at', `${weekEnd}T23:59:59`)

  const appts = (appointmentsData || []) as AppointmentRow[]
  const convs = (conversationsData || []) as ConversationRow[]

  const stats = {
    total_appointments: appts.length,
    confirmed: appts.filter(a => a.status === 'confirmed').length,
    cancelled: appts.filter(a => a.status === 'cancelled').length,
    completed: appts.filter(a => a.status === 'completed').length,
    total_calls: convs.filter(c => c.channel === 'phone').length,
    total_chats: convs.filter(c => c.channel === 'chat').length,
    avg_duration_sec: convs.length > 0
      ? Math.round(convs.reduce((sum, c) => sum + (c.duration_sec || 0), 0) / convs.length)
      : 0,
    booked_from_calls: convs.filter(c => c.outcome === 'booked').length,
  }

  const callsByHour = Array.from({ length: 12 }, (_, i) => {
    const hour = i + 8
    const count = appts.filter(a => new Date(a.starts_at).getHours() === hour).length
    return { hour, count }
  })

  return NextResponse.json({ stats, callsByHour, recentAppointments: appts.slice(0, 10) })
}
