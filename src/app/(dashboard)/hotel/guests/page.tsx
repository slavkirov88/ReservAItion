import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default async function GuestsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: tenant } = await supabase.from('tenants').select('id').eq('owner_id', user!.id).single()

  const { data: reservations } = await supabase
    .from('room_reservations')
    .select('guest_name, guest_email, guest_phone, check_in, check_out, status, total_price')
    .eq('tenant_id', tenant!.id)
    .order('created_at', { ascending: false })

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Гости</h1>
      <div className="space-y-2">
        {(reservations ?? []).map((r, i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{r.guest_name}</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-1">
              <p>{r.guest_email} · {r.guest_phone}</p>
              <p>{r.check_in} → {r.check_out} · {r.total_price} EUR · {r.status}</p>
            </CardContent>
          </Card>
        ))}
        {(!reservations || reservations.length === 0) && (
          <p className="text-muted-foreground">Няма регистрирани гости.</p>
        )}
      </div>
    </div>
  )
}
