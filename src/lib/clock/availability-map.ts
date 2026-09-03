// ---------------------------------------------------------------------------
// rates_availability -> rows for `clock_availability_cache`.
//
// A pure function on purpose: no Supabase, no network. The nesting Clock uses
// (room type -> rate -> date) is the part that is easy to get wrong, and it is
// the part worth having tests on.
// ---------------------------------------------------------------------------

import type { ClockAvailabilityEntry } from './voice'

export interface ClockAvailabilityRow {
  tenant_id: string
  clock_room_type_id: number
  room_type_name: string | null
  clock_rate_id: number
  date: string
  free: boolean
  price_cents: number | null
  currency: string | null
  free_rooms: number | null
  min_stay: number | null
  closed_for_arrival: boolean
  stop_from_sale: boolean
  fetched_at: string
}

export function toCacheRows(
  tenantId: string,
  response: ClockAvailabilityEntry[],
  roomTypeNames: Record<number, string> = {},
  fetchedAt: Date = new Date(),
): ClockAvailabilityRow[] {
  if (!Array.isArray(response)) return []

  const stamp = fetchedAt.toISOString()
  const rows: ClockAvailabilityRow[] = []

  for (const entry of response) {
    for (const [rateId, byDate] of Object.entries(entry?.rates ?? {})) {
      for (const [date, day] of Object.entries(byDate ?? {})) {
        const restriction = day?.rate_restriction ?? {}
        const stopFromSale = restriction.stop_from_sale === true

        rows.push({
          tenant_id: tenantId,
          clock_room_type_id: entry.id,
          room_type_name: roomTypeNames[entry.id] ?? null,
          clock_rate_id: Number(rateId),
          date,
          // Clock already reports a stopped day as not free. The `&&` is here
          // for the day it does not: selling a room the hotel has closed costs
          // more than missing one it had open.
          free: day?.free === true && !stopFromSale,
          // A day without a price is a day we cannot quote. Zero would have the
          // agent give the room away.
          price_cents: day?.price?.cents ?? null,
          currency: day?.price?.currency ?? null,
          free_rooms: day?.room_type_free_rooms ?? null,
          min_stay: restriction.min_stay ?? null,
          closed_for_arrival: restriction.close_for_arrival === true,
          stop_from_sale: stopFromSale,
          fetched_at: stamp,
        })
      }
    }
  }

  return rows
}
