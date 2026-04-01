import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: tenant } = await supabase
    .from('tenants')
    .select('business_name, slug, phone, address, languages, website_url, website_content, bank_iban, bank_name, company_name, company_address, deposit_percent')
    .eq('owner_id', user.id)
    .single()

  if (!tenant) return NextResponse.json({ error: 'No tenant' }, { status: 404 })
  return NextResponse.json(tenant)
}

export async function PUT(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json() as { business_name?: string; phone?: string; address?: string; bank_iban?: string; bank_name?: string; company_name?: string; company_address?: string; deposit_percent?: number }

  const { data: tenant, error } = await supabase
    .from('tenants')
    .update({
      business_name: body.business_name,
      phone: body.phone,
      address: body.address,
      bank_iban: body.bank_iban,
      bank_name: body.bank_name,
      company_name: body.company_name,
      company_address: body.company_address,
      deposit_percent: body.deposit_percent,
      updated_at: new Date().toISOString(),
    })
    .eq('owner_id', user.id)
    .select('id')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true, id: tenant.id })
}
