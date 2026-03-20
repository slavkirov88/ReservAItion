import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { createHotelVapiAssistant } from '@/lib/vapi/vapi-service'

export async function POST() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const serviceClient = await createServiceClient()

    const { data: tenant } = await serviceClient
      .from('tenants')
      .select('*')
      .eq('owner_id', user.id)
      .single()

    if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })

    const { data: profileData } = await serviceClient
      .from('business_profiles')
      .select('*')
      .eq('tenant_id', tenant.id)
      .single()

    const profile = profileData ?? {}

    // Create hotel Vapi assistant
    const { assistantId } = await createHotelVapiAssistant(
      tenant,
      {
        welcome_message_bg: (profile as { welcome_message_bg?: string }).welcome_message_bg ?? 'Здравейте!',
        faqs: ((profile as { faqs?: Array<{ question: string; answer: string }> }).faqs ?? []),
        services: [],
        booking_rules: '',
        address: tenant.address ?? '',
      }
    )

    // Mark trial start + save assistant ID
    const trialEndsAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    await serviceClient.from('tenants').update({
      vapi_assistant_id: assistantId,
      trial_ends_at: trialEndsAt,
    }).eq('id', tenant.id)

    return NextResponse.json({ ok: true, assistantId })
  } catch (error) {
    console.error('Hotel complete error:', error)
    return NextResponse.json({ error: 'Failed to go live' }, { status: 500 })
  }
}
