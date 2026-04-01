import { createServiceClient } from '@/lib/supabase/server'
import { generateICalFeed } from '@/lib/ical'
import type { ReservationRow, BlockedDateRow } from '@/types/database'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ apiKey: string }> }
) {
  const { apiKey } = await params
  const supabase = await createServiceClient()

  const { data: tenant } = await supabase
    .from('tenants')
    .select('id, business_name')
    .eq('public_api_key', apiKey)
    .single()

  if (!tenant) {
    return new Response('Invalid API key', { status: 401 })
  }

  const [{ data: reservations }, { data: blockedDates }] = await Promise.all([
    supabase
      .from('reservations')
      .select('*')
      .eq('tenant_id', tenant.id)
      .in('status', ['confirmed'])
      .order('check_in_date', { ascending: true }),
    supabase
      .from('blocked_dates')
      .select('*')
      .eq('tenant_id', tenant.id)
      .order('start_date', { ascending: true }),
  ])

  const reservationEvents = (reservations as ReservationRow[] || []).map(r => ({
    uid: `reservation-${r.id}@reservaition`,
    summary: r.guest_name,
    dtstart: r.check_in_date.slice(0, 10),
    dtend: r.check_out_date ? r.check_out_date.slice(0, 10) : r.check_in_date.slice(0, 10),
    description: [r.notes, r.guest_phone].filter(Boolean).join(' | '),
    status: 'CONFIRMED',
  }))

  const blockedEvents = (blockedDates as BlockedDateRow[] || []).map(b => ({
    uid: `blocked-${b.id}@reservaition`,
    summary: b.reason || 'Блокирано',
    dtstart: b.start_date,
    dtend: b.end_date,
    description: b.reason || 'Manually blocked',
    status: 'CONFIRMED',
  }))

  const ics = generateICalFeed([...reservationEvents, ...blockedEvents], tenant.business_name)

  return new Response(ics, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'attachment; filename="calendar.ics"',
      'Cache-Control': 'no-cache',
    },
  })
}
