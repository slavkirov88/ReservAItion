import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

async function getTenant(supabase: SupabaseClient<Database>, userId: string) {
  const { data } = await supabase.from('tenants').select('id').eq('owner_id', userId).single()
  return data
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const tenant = await getTenant(supabase, user.id)
  if (!tenant) return NextResponse.json({ error: 'No tenant' }, { status: 404 })

  const { data } = await supabase
    .from('schedule_overrides')
    .select('*')
    .eq('tenant_id', tenant.id)
    .order('date')

  return NextResponse.json(data || [])
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const tenant = await getTenant(supabase, user.id)
  if (!tenant) return NextResponse.json({ error: 'No tenant' }, { status: 404 })

  const body = await request.json()
  const { error } = await supabase.from('schedule_overrides').upsert({
    tenant_id: tenant.id,
    date: body.date,
    override_type: body.override_type,
    note: body.note || null,
  }, { onConflict: 'tenant_id,date' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

export async function DELETE(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const tenant = await getTenant(supabase, user.id)
  if (!tenant) return NextResponse.json({ error: 'No tenant' }, { status: 404 })

  const { searchParams } = new URL(request.url)
  const date = searchParams.get('date')
  if (!date) return NextResponse.json({ error: 'Date required' }, { status: 400 })

  await supabase.from('schedule_overrides').delete().eq('tenant_id', tenant.id).eq('date', date)
  return NextResponse.json({ success: true })
}
