import { createClient } from '@/lib/supabase/server'
import { RoomsClient } from '@/components/hotel/RoomsClient'

export default async function RoomsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: tenant } = await supabase.from('tenants').select('id').eq('owner_id', user!.id).single()
  const { data: rooms } = await supabase.from('rooms').select('*').eq('tenant_id', tenant!.id).order('created_at')
  return <RoomsClient initialRooms={rooms ?? []} />
}
