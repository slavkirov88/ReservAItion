import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: tenant } = await supabase
    .from('tenants').select('id').eq('owner_id', user.id).single()
  if (!tenant) return NextResponse.json({ error: 'No tenant' }, { status: 404 })

  const { data } = await supabase
    .from('ical_feeds')
    .select('*')
    .eq('tenant_id', tenant.id)
    .order('created_at')

  return NextResponse.json(data || [])
}

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: tenant } = await supabase
    .from('tenants').select('id').eq('owner_id', user.id).single()
  if (!tenant) return NextResponse.json({ error: 'No tenant' }, { status: 404 })

  const { url, label } = await req.json() as { url: string; label?: string }
  if (!url) return NextResponse.json({ error: 'url required' }, { status: 400 })

  const { data, error } = await supabase
    .from('ical_feeds')
    .insert({ tenant_id: tenant.id, url, label: label || null })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
