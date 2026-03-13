import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { bookRateLimit, checkRateLimit } from '@/lib/rate-limit'
import { addMinutes, parseISO, format } from 'date-fns'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { api_key, patient_name, patient_phone, service, starts_at } = body

    if (!api_key || !patient_name || !patient_phone || !service || !starts_at) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const rateLimitResponse = await checkRateLimit(bookRateLimit, api_key as string)
    if (rateLimitResponse) return rateLimitResponse

    const supabase = await createServiceClient()

    const { data: tenant } = await supabase
      .from('tenants')
      .select('id')
      .eq('public_api_key', api_key)
      .single()

    if (!tenant) return NextResponse.json({ error: 'Invalid API key' }, { status: 401 })

    // Get slot duration from rule
    const startDate = parseISO(starts_at)
    const date = format(startDate, 'yyyy-MM-dd')
    const dayOfWeek = startDate.getDay()

    // Suppress unused variable warning - date is used implicitly via dayOfWeek context
    void date

    const { data: rule } = await supabase
      .from('schedule_rules')
      .select('slot_duration_min')
      .eq('tenant_id', tenant.id)
      .eq('day_of_week', dayOfWeek)
      .single()

    const slotDuration = rule?.slot_duration_min || 30
    const endsAt = addMinutes(startDate, slotDuration).toISOString()

    // Check slot is still available
    const { data: existing } = await supabase
      .from('appointments')
      .select('id')
      .eq('tenant_id', tenant.id)
      .eq('starts_at', starts_at)
      .in('status', ['confirmed'])
      .single()

    if (existing) {
      return NextResponse.json({ error: 'Slot no longer available' }, { status: 409 })
    }

    const { data: appointment, error } = await supabase
      .from('appointments')
      .insert({
        tenant_id: tenant.id,
        patient_name,
        patient_phone,
        service,
        starts_at,
        ends_at: endsAt,
        status: 'confirmed',
        channel: 'chat',
      })
      .select('id')
      .single()

    if (error) throw error

    return NextResponse.json({ appointment_id: appointment.id, confirmation: 'Часът е записан успешно.' })
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Server error' }, { status: 500 })
  }
}
