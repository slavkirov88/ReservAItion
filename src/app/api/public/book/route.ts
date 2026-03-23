import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { addMinutes, parseISO, format } from 'date-fns'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { api_key, guest_name, guest_phone, service, starts_at, check_in_date, check_out_date, room_type } = body

    const effectiveCheckin = check_in_date || starts_at
    const effectiveCheckout = check_out_date || null
    const effectiveService = room_type || service || null
    if (!api_key || !guest_name || !guest_phone || !effectiveCheckin) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const supabase = await createServiceClient()

    const { data: tenant } = await supabase
      .from('tenants')
      .select('id')
      .eq('public_api_key', api_key)
      .single()

    if (!tenant) return NextResponse.json({ error: 'Invalid API key' }, { status: 401 })

    // Get slot duration from rule (kept for backward compat)
    const startDate = parseISO(effectiveCheckin)
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
    void endsAt

    // Check slot is still available
    const { data: existing } = await supabase
      .from('reservations')
      .select('id')
      .eq('tenant_id', tenant.id)
      .eq('check_in_date', effectiveCheckin)
      .in('status', ['confirmed'])
      .single()

    if (existing) {
      return NextResponse.json({ error: 'Slot no longer available' }, { status: 409 })
    }

    const { data: appointment, error } = await supabase
      .from('reservations')
      .insert({
        tenant_id: tenant.id,
        guest_name,
        guest_phone,
        notes: effectiveService,
        check_in_date: effectiveCheckin,
        check_out_date: effectiveCheckout,
        status: 'confirmed',
        channel: 'chat',
      })
      .select('id')
      .single()

    if (error) throw error

    return NextResponse.json({ appointment_id: appointment.id, confirmation: 'Резервацията е потвърдена!' })
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Server error' }, { status: 500 })
  }
}
