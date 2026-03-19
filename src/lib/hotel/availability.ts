import { createServiceClient } from '@/lib/supabase/server'

export interface DateRange {
  start: string
  end: string
}

export function buildBlockedRanges(
  reservations: Array<{ check_in: string; check_out: string }>,
  icalBlocks: Array<{ start_date: string; end_date: string }>
): DateRange[] {
  return [
    ...reservations.map(r => ({ start: r.check_in, end: r.check_out })),
    ...icalBlocks.map(b => ({ start: b.start_date, end: b.end_date })),
  ]
}

// Half-open interval [checkIn, checkOut) overlap check
export function isDateRangeAvailable(
  checkIn: string,
  checkOut: string,
  blocked: DateRange[]
): boolean {
  for (const range of blocked) {
    // Overlap if: checkIn < range.end AND checkOut > range.start
    if (checkIn < range.end && checkOut > range.start) return false
  }
  return true
}

export async function checkRoomAvailability(
  tenantId: string,
  checkIn: string,   // YYYY-MM-DD
  checkOut: string,  // YYYY-MM-DD (exclusive)
  guests: number
): Promise<Array<{
  id: string
  name: string
  type: string
  capacity: number
  base_price: number
  amenities: string[]
  nights: number
  total_price: number
}>> {
  const supabase = await createServiceClient()

  const { data: rooms } = await supabase
    .from('rooms')
    .select('*')
    .eq('tenant_id', tenantId)
    .gte('capacity', guests)

  if (!rooms || rooms.length === 0) return []

  const nights =
    (new Date(checkOut).getTime() - new Date(checkIn).getTime()) /
    (1000 * 60 * 60 * 24)

  const available = []

  for (const room of rooms) {
    const { data: reservations, error: resErr } = await supabase
      .from('room_reservations')
      .select('check_in, check_out')
      .eq('room_id', room.id)
      .in('status', ['on_hold', 'confirmed'])
    if (resErr) throw new Error(`Failed to fetch reservations for room ${room.id}: ${resErr.message}`)

    const { data: icalBlocks, error: icalErr } = await supabase
      .from('ical_blocks')
      .select('start_date, end_date')
      .eq('room_id', room.id)
    if (icalErr) throw new Error(`Failed to fetch iCal blocks for room ${room.id}: ${icalErr.message}`)

    const blocked = buildBlockedRanges(reservations ?? [], icalBlocks ?? [])

    if (isDateRangeAvailable(checkIn, checkOut, blocked)) {
      available.push({
        id: room.id,
        name: room.name,
        type: room.type,
        capacity: room.capacity,
        base_price: room.base_price,
        amenities: room.amenities,
        nights,
        total_price: room.base_price * nights,
      })
    }
  }

  return available
}
