import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default async function HotelOverviewPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: tenant } = await supabase.from('tenants').select('id').eq('owner_id', user!.id).single()

  const today = new Date().toISOString().split('T')[0]

  const [{ count: arrivals }, { count: departures }, { count: onHold }, { count: confirmed }] =
    await Promise.all([
      supabase.from('room_reservations').select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenant!.id).eq('check_in', today).eq('status', 'confirmed'),
      supabase.from('room_reservations').select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenant!.id).eq('check_out', today).eq('status', 'confirmed'),
      supabase.from('room_reservations').select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenant!.id).eq('status', 'on_hold'),
      supabase.from('room_reservations').select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenant!.id).eq('status', 'confirmed'),
    ])

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Преглед</h1>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-sm">Пристигания днес</CardTitle></CardHeader>
          <CardContent><p className="text-3xl font-bold">{arrivals ?? 0}</p></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm">Заминавания днес</CardTitle></CardHeader>
          <CardContent><p className="text-3xl font-bold">{departures ?? 0}</p></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm">Чакащи плащане</CardTitle></CardHeader>
          <CardContent><p className="text-3xl font-bold">{onHold ?? 0}</p></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm">Потвърдени</CardTitle></CardHeader>
          <CardContent><p className="text-3xl font-bold">{confirmed ?? 0}</p></CardContent>
        </Card>
      </div>
    </div>
  )
}
