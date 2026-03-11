import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: tenant } = await supabase.from('tenants').select('id').eq('owner_id', user.id).single()
  if (!tenant) return NextResponse.json({ error: 'No tenant' }, { status: 404 })

  const { data: rules } = await supabase
    .from('schedule_rules')
    .select('*')
    .eq('tenant_id', tenant.id)
    .order('day_of_week')

  return NextResponse.json(rules || [])
}

export async function PUT(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: tenant } = await supabase.from('tenants').select('id').eq('owner_id', user.id).single()
  if (!tenant) return NextResponse.json({ error: 'No tenant' }, { status: 404 })

  const rules = await request.json()

  // Upsert all rules
  const upserts = rules.map((r: Record<string, unknown>) => ({
    ...r,
    tenant_id: tenant.id,
  }))

  const { error } = await supabase
    .from('schedule_rules')
    .upsert(upserts, { onConflict: 'tenant_id,day_of_week' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
