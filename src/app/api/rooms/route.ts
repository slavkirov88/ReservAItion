import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: tenant } = await supabase.from('tenants').select('id').eq('owner_id', user.id).single()
  if (!tenant) return NextResponse.json({ error: 'No tenant' }, { status: 404 })

  const [{ data: roomTypes }, { data: rooms }] = await Promise.all([
    supabase.from('room_types').select('*').eq('tenant_id', tenant.id).order('created_at'),
    supabase.from('rooms').select('*').eq('tenant_id', tenant.id).order('room_number'),
  ])

  return NextResponse.json({ roomTypes: roomTypes || [], rooms: rooms || [] })
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: tenant } = await supabase.from('tenants').select('id').eq('owner_id', user.id).single()
  if (!tenant) return NextResponse.json({ error: 'No tenant' }, { status: 404 })

  const body = await request.json()
  const { type, ...fields } = body // type: 'room_type' | 'room'

  if (type === 'room_type') {
    const { data, error } = await supabase
      .from('room_types')
      .insert({ ...fields, tenant_id: tenant.id })
      .select()
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ roomType: data })
  }

  if (type === 'room') {
    const { data, error } = await supabase
      .from('rooms')
      .insert({ ...fields, tenant_id: tenant.id })
      .select()
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ room: data })
  }

  return NextResponse.json({ error: 'Invalid type' }, { status: 400 })
}
