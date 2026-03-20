import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: tenant } = await supabase.from('tenants').select('id').eq('owner_id', user.id).single()
  if (!tenant) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data } = await supabase
    .from('room_reservations')
    .select('*, rooms(name, type)')
    .eq('tenant_id', tenant.id)
    .order('check_in', { ascending: false })
  return NextResponse.json(data ?? [])
}
