import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { format, startOfWeek, endOfWeek } from 'date-fns'
import { bg } from 'date-fns/locale'
import { StatsCards } from '@/components/analytics/StatsCards'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { MessageSquare, Phone, CalendarDays, TrendingUp } from 'lucide-react'
import { differenceInDays } from 'date-fns'
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

  const thisMonthStart = format(new Date(now.getFullYear(), now.getMonth(), 1), 'yyyy-MM-dd')

  const [
    { data: checkinsData },
    { data: checkoutsData },
    { data: conversationsData },
    { data: roomsData },
    { data: recentData },
    { data: weeklyReservationsData },
    { data: monthlyRevenueData },
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
    supabase
      .from('reservations')
      .select('id, channel', { count: 'exact' })
      .eq('tenant_id', tenant.id)
      .gte('check_in_date', weekStart)
      .lte('check_in_date', weekEnd),
    supabase
      .from('reservations')
      .select('check_in_date, check_out_date, room_type_id, room_types(price_per_night)')
      .eq('tenant_id', tenant.id)
      .gte('check_in_date', thisMonthStart)
      .in('status', ['confirmed', 'completed']),
  ])

  const rooms = (roomsData || []) as { status: string }[]
  const convs = (conversationsData || []) as { channel: string }[]
  const occupiedRooms = rooms.filter(r => r.status === 'occupied').length
  const occupancyPercent = rooms.length > 0 ? Math.round((occupiedRooms / rooms.length) * 100) : 0

  type RevenueRow = { check_in_date: string; check_out_date: string | null; room_types: { price_per_night: number } | null }
  const monthlyRevenue = ((monthlyRevenueData || []) as RevenueRow[]).reduce((sum, r) => {
    if (!r.check_out_date || !r.room_types?.price_per_night) return sum
    const nights = differenceInDays(new Date(r.check_out_date), new Date(r.check_in_date))
    return sum + (nights > 0 ? nights * r.room_types.price_per_night : 0)
  }, 0)

  const weeklyReservations = (weeklyReservationsData || []) as { id: string; channel: string }[]
  const weeklyChats = weeklyReservations.filter(r => r.channel === 'chat').length
  const weeklyPhone = weeklyReservations.filter(r => r.channel === 'phone').length

  const stats = {
    occupancy_percent: occupancyPercent,
    checkins_today: checkinsData?.length ?? 0,
    checkouts_today: checkoutsData?.length ?? 0,
    total_calls_week: convs.filter(c => c.channel === 'phone').length,
    reservations_week: weeklyReservations.length,
    chats_week: weeklyChats,
    phone_reservations_week: weeklyPhone,
  }

  const reservations = (recentData || []) as ReservationRow[]

  const statusColors: Record<string, string> = {
    inquiry: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
    confirmed: 'bg-green-500/10 text-green-400 border-green-500/30',
    cancelled: 'bg-red-500/10 text-red-400 border-red-500/30',
    completed: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
    no_show: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30',
    pending_payment: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
  }

  const statusLabels: Record<string, string> = {
    inquiry: 'Запитване',
    confirmed: 'Потвърдена',
    cancelled: 'Отменена',
    completed: 'Завършена',
    no_show: 'Неявил се',
    pending_payment: 'Чака плащане',
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">{tenant.business_name} — {format(now, 'dd MMMM yyyy', { locale: bg })}</p>
      </div>

      <StatsCards stats={stats} />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Резервации тази седмица</CardTitle>
            <CalendarDays className="h-4 w-4 text-indigo-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.reservations_week}</div>
            <p className="text-xs text-muted-foreground mt-1">общо потвърдени</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Чат резервации</CardTitle>
            <MessageSquare className="h-4 w-4 text-green-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.chats_week}</div>
            <p className="text-xs text-muted-foreground mt-1">от AI чат widget</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Телефонни резервации</CardTitle>
            <Phone className="h-4 w-4 text-purple-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.phone_reservations_week}</div>
            <p className="text-xs text-muted-foreground mt-1">от AI гласов асистент</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Приходи този месец</CardTitle>
            <TrendingUp className="h-4 w-4 text-yellow-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">€{monthlyRevenue.toLocaleString('bg-BG')}</div>
            <p className="text-xs text-muted-foreground mt-1">от потвърдени резервации</p>
          </CardContent>
        </Card>
      </div>

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
