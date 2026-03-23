import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { createVapiAssistant } from '@/lib/vapi/vapi-service'
import type { TenantInsert, TenantRow, BusinessProfileInsert, ScheduleRuleInsert } from '@/types/database'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { businessName, slug, phone, address, roomTypes, workingHours, faqs } = body

    if (!businessName || !slug) {
      return NextResponse.json({ error: 'Business name and slug are required' }, { status: 400 })
    }

    const serviceClient = await createServiceClient()

    // 1. Create tenant
    const tenantInsert: TenantInsert = {
      owner_id: user.id,
      business_name: businessName,
      slug,
      phone: phone || null,
      address: address || null,
      languages: ['bg'],
    }
    const { data: tenantRaw, error: tenantError } = await serviceClient
      .from('tenants')
      .insert(tenantInsert)
      .select('*')
      .single()
    const tenant = tenantRaw as TenantRow | null

    if (tenantError) {
      if (tenantError.code === '23505') {
        return NextResponse.json({ error: 'Slug вече е зает. Опитайте с друг.' }, { status: 409 })
      }
      throw tenantError
    }
    if (!tenant) {
      throw new Error('Failed to create tenant')
    }

    // 2. Create business profile
    const profileInsert: BusinessProfileInsert = {
      tenant_id: tenant.id,
      faqs: faqs || [],
      booking_rules: '',
      welcome_message_bg: 'Здравейте! Как мога да ви помогна?',
      welcome_message_en: 'Hello! How can I help you?',
    }
    await serviceClient
      .from('business_profiles')
      .insert(profileInsert)

    // 2b. Insert room types if provided
    if (Array.isArray(roomTypes) && roomTypes.length > 0) {
      const roomTypeInserts = roomTypes.map((rt: { name: string; capacity: number; price_per_night: number }) => ({
        tenant_id: tenant.id,
        name: rt.name,
        capacity: rt.capacity,
        price_per_night: rt.price_per_night,
      }))
      await serviceClient
        .from('room_types')
        .insert(roomTypeInserts)
    }

    // 3. Create schedule rules
    const activeHours = (workingHours || []).filter((h: { is_active: boolean }) => h.is_active)
    if (activeHours.length > 0) {
      const scheduleInserts: ScheduleRuleInsert[] = activeHours.map((h: {
        day_of_week: number
        start_time: string
        end_time: string
        slot_duration_min: number
        break_start: string
        break_end: string
      }) => ({
        tenant_id: tenant.id,
        day_of_week: h.day_of_week,
        start_time: h.start_time,
        end_time: h.end_time,
        slot_duration_min: h.slot_duration_min,
        break_start: h.break_start || null,
        break_end: h.break_end || null,
        is_active: true,
      }))
      await serviceClient
        .from('schedule_rules')
        .insert(scheduleInserts)
    }

    // 4. Create Vapi assistant
    let vapiAssistantId: string | null = null
    try {
      const { assistantId } = await createVapiAssistant(
        { id: tenant.id, business_name: tenant.business_name, languages: tenant.languages || ['bg'] },
        {
          room_types: (roomTypes || []).map((rt: { name: string; capacity: number; price_per_night: number }) => ({
            name: rt.name,
            capacity: rt.capacity,
            price_per_night: rt.price_per_night,
          })),
          faqs: faqs || [],
          booking_rules: '',
          welcome_message_bg: 'Здравейте! Как мога да ви помогна?',
          address: address || '',
        }
      )
      vapiAssistantId = assistantId
      await serviceClient
        .from('tenants')
        .update({ vapi_assistant_id: assistantId })
        .eq('id', tenant.id)
    } catch (vapiError) {
      console.error('Vapi assistant creation failed (non-fatal):', vapiError)
    }

    return NextResponse.json({
      tenantId: tenant.id,
      publicApiKey: tenant.public_api_key,
      vapiPhone: tenant.vapi_phone_number || '',
      vapiAssistantId,
    })
  } catch (error: unknown) {
    console.error('Onboarding error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
