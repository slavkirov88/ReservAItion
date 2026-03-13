import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { updateVapiAssistant } from '@/lib/vapi/vapi-service'
import type { FAQ } from '@/types/database'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: tenant } = await supabase
    .from('tenants')
    .select('id')
    .eq('owner_id', user.id)
    .single()

  if (!tenant) return NextResponse.json({ error: 'No tenant' }, { status: 404 })

  const { data: profile } = await supabase
    .from('business_profiles')
    .select('faqs, booking_rules, welcome_message_bg, welcome_message_en')
    .eq('tenant_id', tenant.id)
    .single()

  return NextResponse.json(profile || {})
}

export async function PUT(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json() as {
    faqs?: FAQ[]
    booking_rules?: string
    welcome_message_bg?: string
    welcome_message_en?: string
  }

  const { data: tenant } = await supabase
    .from('tenants')
    .select('id, business_name, languages, address, vapi_assistant_id')
    .eq('owner_id', user.id)
    .single()

  if (!tenant) return NextResponse.json({ error: 'No tenant' }, { status: 404 })

  const { error } = await supabase
    .from('business_profiles')
    .update({ ...body, updated_at: new Date().toISOString() })
    .eq('tenant_id', tenant.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Sync to Vapi if assistant exists
  if (tenant.vapi_assistant_id) {
    try {
      const { data: profile } = await supabase
        .from('business_profiles')
        .select('services, faqs, booking_rules, welcome_message_bg')
        .eq('tenant_id', tenant.id)
        .single()

      await updateVapiAssistant(tenant.vapi_assistant_id, {
        id: tenant.id,
        business_name: tenant.business_name,
        languages: tenant.languages,
      }, {
        services: profile?.services || [],
        faqs: profile?.faqs || [],
        booking_rules: profile?.booking_rules || '',
        welcome_message_bg: profile?.welcome_message_bg || 'Здравейте!',
        address: tenant.address || '',
      })
    } catch {
      // Non-fatal
    }
  }

  return NextResponse.json({ success: true })
}
