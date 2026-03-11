import { createServiceClient } from '@/lib/supabase/server'
import { generateSlots } from '@/lib/scheduling/slot-generator'
import type { ScheduleRuleRow } from '@/types/database'
import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { addMinutes, parseISO, format } from 'date-fns'

interface ToolCallPayload {
  message?: {
    toolCalls?: Array<{
      function?: {
        name?: string
        arguments?: string
      }
    }>
  }
  toolName?: string
  parameters?: Record<string, unknown>
}

interface BookedRow {
  starts_at: string
  ends_at: string
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ tenantId: string }> }
) {
  const { tenantId } = await params

  // Validate HMAC signature
  const signature = request.headers.get('x-vapi-signature')
  const body = await request.text()

  if (process.env.VAPI_WEBHOOK_SECRET && signature) {
    const expected = crypto
      .createHmac('sha256', process.env.VAPI_WEBHOOK_SECRET)
      .update(body)
      .digest('hex')
    if (signature !== expected) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const payload = JSON.parse(body) as ToolCallPayload
  const toolName =
    payload.message?.toolCalls?.[0]?.function?.name || payload.toolName
  const rawArgs = payload.message?.toolCalls?.[0]?.function?.arguments
  const parameters = rawArgs
    ? (JSON.parse(rawArgs) as Record<string, string>)
    : (payload.parameters as Record<string, string>) || {}

  const supabase = await createServiceClient()

  if (toolName === 'get_available_slots') {
    const { date } = parameters
    const dateObj = new Date(date)
    const dayOfWeek = dateObj.getDay()

    const { data: override } = await supabase
      .from('schedule_overrides')
      .select('override_type')
      .eq('tenant_id', tenantId)
      .eq('date', date)
      .single()

    if (override?.override_type === 'closed') {
      return NextResponse.json({ result: 'На тази дата клиниката е затворена.' })
    }

    const { data: ruleData } = await supabase
      .from('schedule_rules')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('day_of_week', dayOfWeek)
      .eq('is_active', true)
      .single()

    const rule = ruleData as ScheduleRuleRow | null

    if (!rule) return NextResponse.json({ result: 'Няма работно време за тази дата.' })

    const { data: booked } = await supabase
      .from('appointments')
      .select('starts_at, ends_at')
      .eq('tenant_id', tenantId)
      .gte('starts_at', `${date}T00:00:00`)
      .lte('starts_at', `${date}T23:59:59`)
      .in('status', ['confirmed'])

    const slots = generateSlots(date, {
      start_time: rule.start_time,
      end_time: rule.end_time,
      slot_duration_min: rule.slot_duration_min,
      break_start: rule.break_start,
      break_end: rule.break_end,
    }, (booked || []) as BookedRow[])

    return NextResponse.json({
      result: slots.length > 0
        ? `Свободни часове на ${date}: ${slots.join(', ')}`
        : `Няма свободни часове на ${date}.`
    })
  }

  if (toolName === 'book_appointment') {
    const { patient_name, patient_phone, service, starts_at } = parameters

    const startDate = parseISO(starts_at)
    const dayOfWeek = startDate.getDay()

    const { data: slotRuleData } = await supabase
      .from('schedule_rules')
      .select('slot_duration_min')
      .eq('tenant_id', tenantId)
      .eq('day_of_week', dayOfWeek)
      .single()

    const slotDuration = (slotRuleData as { slot_duration_min?: number } | null)?.slot_duration_min || 30
    const endsAt = addMinutes(startDate, slotDuration).toISOString()

    const { data: existing } = await supabase
      .from('appointments')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('starts_at', starts_at)
      .in('status', ['confirmed'])
      .single()

    if (existing) {
      return NextResponse.json({ result: 'Съжалявам, този час вече е зает. Моля изберете друг.' })
    }

    const { data: appointment, error } = await supabase
      .from('appointments')
      .insert({
        tenant_id: tenantId,
        patient_name,
        patient_phone,
        service,
        starts_at,
        ends_at: endsAt,
        status: 'confirmed',
        channel: 'phone',
      })
      .select('id')
      .single()

    if (error || !appointment) {
      return NextResponse.json({ result: 'Грешка при записване. Моля опитайте отново.' })
    }

    return NextResponse.json({
      result: `Часът е записан успешно! ${patient_name}, записан за ${service} на ${format(startDate, 'dd.MM.yyyy')} в ${format(startDate, 'HH:mm')}. Ще получите потвърждение.`
    })
  }

  if (toolName === 'get_business_info') {
    const { data: tenant } = await supabase
      .from('tenants')
      .select('business_name, address, phone')
      .eq('id', tenantId)
      .single()

    const { data: profile } = await supabase
      .from('business_profiles')
      .select('services, faqs, welcome_message_bg')
      .eq('tenant_id', tenantId)
      .single()

    const info = [
      tenant?.business_name ? `Бизнес: ${tenant.business_name}` : '',
      tenant?.address ? `Адрес: ${tenant.address}` : '',
      tenant?.phone ? `Телефон: ${tenant.phone}` : '',
      profile?.services ? `Услуги: ${JSON.stringify(profile.services)}` : '',
    ].filter(Boolean).join('\n')

    return NextResponse.json({ result: info || 'Информацията не е налична.' })
  }

  return NextResponse.json({ result: 'Неизвестна команда.' })
}
