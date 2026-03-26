import type { SupabaseClient } from '@supabase/supabase-js'

export interface AvailableRoomType {
  id: string
  name: string
  description: string | null
  capacity: number
  price_per_night: number
  total_rooms: number
  available_rooms: number
}

/**
 * Returns the price per night for a specific date given seasonal pricing records.
 * If multiple seasons match, picks the shortest (most specific) one.
 * Falls back to basePrice if no season matches.
 */
export function getSeasonalPrice(
  seasons: Array<{ start_date: string; end_date: string; price_per_night: number }>,
  date: string, // YYYY-MM-DD
  basePrice: number,
): number {
  const matching = seasons.filter(s => s.start_date <= date && s.end_date >= date)
  if (matching.length === 0) return basePrice

  matching.sort((a, b) => {
    const lenA = new Date(a.end_date).getTime() - new Date(a.start_date).getTime()
    const lenB = new Date(b.end_date).getTime() - new Date(b.start_date).getTime()
    return lenA - lenB
  })
  return matching[0].price_per_night
}

/**
 * Calculates total price for a stay, summing price per night across seasons.
 * checkIn inclusive, checkOut exclusive (standard hotel convention).
 */
export function calculateTotalPrice(
  seasons: Array<{ start_date: string; end_date: string; price_per_night: number }>,
  checkIn: string,  // YYYY-MM-DD
  checkOut: string, // YYYY-MM-DD
  basePrice: number,
): number {
  const end = new Date(checkOut)
  let total = 0
  const cur = new Date(checkIn)
  while (cur < end) {
    const dateStr = cur.toISOString().slice(0, 10)
    total += getSeasonalPrice(seasons, dateStr, basePrice)
    cur.setDate(cur.getDate() + 1)
  }
  return total
}

/**
 * Returns room types that have at least one free room for the given date range.
 * price_per_night reflects the seasonal price for the check-in night (or base price).
 */
export async function getAvailableRoomTypes(
  supabase: SupabaseClient,
  tenantId: string,
  checkIn: string,   // YYYY-MM-DD
  checkOut: string,  // YYYY-MM-DD
): Promise<AvailableRoomType[]> {
  // 1. All room types for this tenant
  const { data: roomTypes } = await supabase
    .from('room_types')
    .select('id, name, description, capacity, price_per_night')
    .eq('tenant_id', tenantId)

  if (!roomTypes || roomTypes.length === 0) return []

  // 2. Seasonal pricing for this tenant
  const { data: seasons } = await supabase
    .from('seasonal_pricing')
    .select('room_type_id, start_date, end_date, price_per_night')
    .eq('tenant_id', tenantId)

  const seasonsByType: Record<string, Array<{ start_date: string; end_date: string; price_per_night: number }>> = {}
  for (const s of seasons || []) {
    if (!seasonsByType[s.room_type_id]) seasonsByType[s.room_type_id] = []
    seasonsByType[s.room_type_id].push(s)
  }

  // 3. Physical rooms per type
  const { data: rooms } = await supabase
    .from('rooms')
    .select('id, room_type_id')
    .eq('tenant_id', tenantId)
    .not('status', 'eq', 'maintenance')

  const roomCountByType: Record<string, number> = {}
  for (const room of rooms || []) {
    roomCountByType[room.room_type_id] = (roomCountByType[room.room_type_id] || 0) + 1
  }

  // 4. Overlapping confirmed reservations per room type
  const { data: overlapping } = await supabase
    .from('reservations')
    .select('room_type_id')
    .eq('tenant_id', tenantId)
    .in('status', ['confirmed'])
    .lt('check_in_date', checkOut)
    .or(`check_out_date.is.null,check_out_date.gt.${checkIn}`)

  const bookedByType: Record<string, number> = {}
  for (const res of overlapping || []) {
    if (res.room_type_id) {
      bookedByType[res.room_type_id] = (bookedByType[res.room_type_id] || 0) + 1
    }
  }

  // 5. Calculate availability + effective price for check-in night
  const available: AvailableRoomType[] = []
  for (const rt of roomTypes) {
    const total = roomCountByType[rt.id] ?? 1
    const booked = bookedByType[rt.id] ?? 0
    const free = total - booked
    if (free > 0) {
      const rtSeasons = seasonsByType[rt.id] || []
      const effectivePrice = getSeasonalPrice(rtSeasons, checkIn, rt.price_per_night)
      available.push({
        id: rt.id,
        name: rt.name,
        description: rt.description,
        capacity: rt.capacity,
        price_per_night: effectivePrice,
        total_rooms: total,
        available_rooms: free,
      })
    }
  }

  return available
}

/**
 * Formats available room types as a human-readable Bulgarian string for AI responses.
 */
export function formatAvailabilityBg(
  rooms: AvailableRoomType[],
  checkIn: string,
  checkOut: string,
): string {
  if (rooms.length === 0) {
    return `За периода ${checkIn} – ${checkOut} няма свободни стаи.`
  }

  const list = rooms
    .map(r => `${r.name}: ${r.available_rooms} свободна/и, до ${r.capacity} гости, ${r.price_per_night} €/нощ`)
    .join('\n')

  return `Свободни стаи за ${checkIn} – ${checkOut}:\n${list}`
}
