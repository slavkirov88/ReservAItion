import { createClient } from '@/lib/supabase/server'
import { ReservationTable } from '@/components/hotel/ReservationTable'
import type { RoomReservationRow } from '@/types/database'

type ReservationWithRoom = RoomReservationRow & { rooms: { name: string; type: string } | null }

export default async function ReservationsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: tenant } = await supabase.from('tenants').select('id').eq('owner_id', user!.id).single()
  const { data: reservations } = await supabase
    .from('room_reservations')
    .select('*, rooms(name, type)')
    .eq('tenant_id', tenant!.id)
    .order('check_in', { ascending: false })
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Резервации</h1>
      <ReservationTable reservations={(reservations ?? []) as unknown as ReservationWithRoom[]} />
    </div>
  )
}
