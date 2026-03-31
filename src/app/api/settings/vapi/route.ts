import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createVapiAssistant } from '@/lib/vapi/vapi-service'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: tenant } = await supabase
    .from('tenants')
    .select('id, business_name, vapi_assistant_id, vapi_phone_number, languages, address')
    .eq('owner_id', user.id)
    .single()

  if (!tenant) return NextResponse.json({ error: 'No tenant' }, { status: 404 })

  return NextResponse.json({
    tenant_id: tenant.id,
    vapi_assistant_id: tenant.vapi_assistant_id || null,
    vapi_phone_number: tenant.vapi_phone_number || null,
  })
}

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: tenant } = await supabase
    .from('tenants')
    .select('id, business_name, languages, address, website_content')
    .eq('owner_id', user.id)
    .single()

  if (!tenant) return NextResponse.json({ error: 'No tenant' }, { status: 404 })

  const { data: profile } = await supabase
    .from('business_profiles')
    .select('faqs, booking_rules, welcome_message_bg')
    .eq('tenant_id', tenant.id)
    .single()

  const { data: roomTypes } = await supabase
    .from('room_types')
    .select('name, capacity, price_per_night')
    .eq('tenant_id', tenant.id)

  try {
    const { assistantId } = await createVapiAssistant(
      { id: tenant.id, business_name: tenant.business_name, languages: tenant.languages || ['bg'] },
      {
        room_types: roomTypes || [],
        faqs: profile?.faqs || [],
        booking_rules: profile?.booking_rules || '',
        welcome_message_bg: profile?.welcome_message_bg || 'Здравейте! Как мога да ви помогна?',
        address: tenant.address || '',
        website_content: tenant.website_content || undefined,
      }
    )

    await supabase
      .from('tenants')
      .update({ vapi_assistant_id: assistantId })
      .eq('id', tenant.id)

    return NextResponse.json({ vapi_assistant_id: assistantId })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Vapi error' },
      { status: 500 }
    )
  }
}
