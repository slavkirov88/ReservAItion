import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { startOfWeek, endOfWeek, format } from 'date-fns'
import { bg } from 'date-fns/locale'
import { StatsCards } from '@/components/analytics/StatsCards'
import { CallsByHourChart } from '@/components/analytics/CallsByHourChart'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { AppointmentStatusBadge } from '@/components/appointments/AppointmentStatusBadge'
import type { AppointmentRow, ConversationRow } from '@/types/database'

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
  const weekStart = format(startOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd')
  const weekEnd = format(endOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd')

  const [{ data: appointmentsData }, { data: conversationsData }] = await Promise.all([
    supabase
      .from('appointments')
      .select('*')
      .eq('tenant_id', tenant.id)
      .gte('starts_at', `${weekStart}T00:00:00`)
      .lte('starts_at', `${weekEnd}T23:59:59`)
      .order('starts_at', { ascending: false }),
    supabase
      .from('conversations')
      .select('*')
      .eq('tenant_id', tenant.id)
      .gte('created_at', `${weekStart}T00:00:00`)
      .lte('created_at', `${weekEnd}T23:59:59`),
  ])

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

  const callsByHour = Array.from({ length: 12 }, (_, i) => ({
    hour: i + 8,
    count: appts.filter(a => new Date(a.starts_at).getHours() === i + 8).length,
  }))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">{tenant.business_name} — тази седмица</p>
      </div>

      <StatsCards stats={stats} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Часове по час на деня</CardTitle>
          </CardHeader>
          <CardContent>
            <CallsByHourChart data={callsByHour} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Последни часове</CardTitle>
          </CardHeader>
          <CardContent>
            {appts.length === 0 ? (
              <p className="text-muted-foreground text-sm">Няма часове тази седмица</p>
            ) : (
              <div className="space-y-3">
                {appts.slice(0, 5).map(a => (
                  <div key={a.id} className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">{a.patient_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {a.service} · {format(new Date(a.starts_at), 'dd MMM HH:mm', { locale: bg })}
                      </p>
                    </div>
                    <AppointmentStatusBadge status={a.status} />
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
