import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: tenant } = await supabase
    .from('tenants')
    .select('id')
    .eq('owner_id', user.id)
    .single()
  if (!tenant) return NextResponse.json({ error: 'No tenant' }, { status: 404 })

  const { searchParams } = new URL(req.url)
  const roomTypeId = searchParams.get('room_type_id')

  let query = supabase
    .from('seasonal_pricing')
    .select('*')
    .eq('tenant_id', tenant.id)
    .order('start_date', { ascending: true })

  if (roomTypeId) query = query.eq('room_type_id', roomTypeId)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(data)
}

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: tenant } = await supabase
    .from('tenants')
    .select('id')
    .eq('owner_id', user.id)
    .single()
  if (!tenant) return NextResponse.json({ error: 'No tenant' }, { status: 404 })

  const body = await req.json()
  const { room_type_id, label, start_date, end_date, price_per_night } = body

  if (!room_type_id || !label || !start_date || !end_date || price_per_night == null) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }
  if (end_date < start_date) {
    return NextResponse.json({ error: 'end_date must be >= start_date' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('seasonal_pricing')
    .insert({ tenant_id: tenant.id, room_type_id, label, start_date, end_date, price_per_night })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
