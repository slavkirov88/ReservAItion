import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { generateSlots } from '@/lib/scheduling/slot-generator'
import { slotsRateLimit, checkRateLimit } from '@/lib/rate-limit'
import type { ScheduleOverrideRow, ScheduleRuleRow } from '@/types/database'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const apiKey = searchParams.get('api_key')
  const date = searchParams.get('date')

  if (!apiKey || !date) {
    return NextResponse.json({ error: 'api_key and date required' }, { status: 400 })
  }

  const rateLimitResponse = await checkRateLimit(slotsRateLimit, apiKey)
  if (rateLimitResponse) return rateLimitResponse

  const supabase = await createServiceClient()

  // Find tenant by public_api_key
  const { data: tenant } = await supabase
    .from('tenants')
    .select('id')
    .eq('public_api_key', apiKey)
    .single()

  if (!tenant) return NextResponse.json({ error: 'Invalid API key' }, { status: 401 })

  // Get day of week for the date
  const dateObj = new Date(date)
  const dayOfWeek = dateObj.getDay()

  // Check for override
  const { data: overrideRaw } = await supabase
    .from('schedule_overrides')
    .select('*')
    .eq('tenant_id', tenant.id)
    .eq('date', date)
    .single()
  const override = overrideRaw as ScheduleOverrideRow | null

  if (override?.override_type === 'closed') {
    return NextResponse.json({ slots: [], date, closed: true })
  }

  // Get schedule rule
  const { data: ruleRaw } = await supabase
    .from('schedule_rules')
    .select('*')
    .eq('tenant_id', tenant.id)
    .eq('day_of_week', dayOfWeek)
    .eq('is_active', true)
    .single()
  const rule = ruleRaw as ScheduleRuleRow | null

  if (!rule) return NextResponse.json({ slots: [], date })

  // Get booked appointments
  const startOfDay = `${date}T00:00:00`
  const endOfDay = `${date}T23:59:59`
  const { data: booked } = await supabase
    .from('appointments')
    .select('starts_at, ends_at')
    .eq('tenant_id', tenant.id)
    .gte('starts_at', startOfDay)
    .lte('starts_at', endOfDay)
    .in('status', ['confirmed'])

  const slots = generateSlots(date, {
    start_time: rule.start_time,
    end_time: rule.end_time,
    slot_duration_min: rule.slot_duration_min,
    break_start: rule.break_start,
    break_end: rule.break_end,
  }, booked || [])

  return NextResponse.json({ slots, date })
}
