import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { format, startOfWeek, endOfWeek } from 'date-fns'
import { bg } from 'date-fns/locale'
import { StatsCards } from '@/components/analytics/StatsCards'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { ReservationRow } from '@/types/database'

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
