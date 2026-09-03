// ---------------------------------------------------------------------------
// A hotel whose PMS owns the inventory.
//
// Reading is deliberately offline: `availability()` touches only
// `clock_availability_cache`. Clock calls rates_availability their heaviest
// endpoint and does not guarantee its speed, and a guest waiting on the phone
// is the worst possible place to discover that. The cache is refreshed by
// /api/cron/clock-availability.
// ---------------------------------------------------------------------------

import type { SupabaseClient } from '@supabase/supabase-js'
import type { ClockTenantConfig } from '@/lib/clock/config'
import type { ClockAvailabilityRow } from '@/lib/clock/availability-map'
import type {
  AvailabilityResult,
  BookingRequest,
  BookingResult,
  GuestCount,
  InventoryProvider,
  RoomOffer,
} from './types'

const MS_PER_DAY = 86_400_000

/** The nights of a stay: arrival included, departure not. */
export function nightsBetween(checkIn: string, checkOut: string | null): string[] {
  const start = new Date(`${checkIn}T00:00:00Z`)
  if (Number.isNaN(start.getTime())) return []

  const end = checkOut ? new Date(`${checkOut}T00:00:00Z`) : start
  const count = Math.max(1, Math.round((end.getTime() - start.getTime()) / MS_PER_DAY))

  return Array.from({ length: count }, (_, i) =>
    new Date(start.getTime() + i * MS_PER_DAY).toISOString().slice(0, 10),
  )
}

interface RateVerdict {
  rateId: number
  pricePerNight: number
  currency: string
  availableRooms: number
  restriction?: string
}

/**
 * What one rate can honestly be offered as, over the whole stay.
 *
 * A night that is not in the cache is not a free night. Reading a gap as
 * availability is how an agent promises a room the hotel has already sold.
 */
function judgeRate(rows: ClockAvailabilityRow[], nights: string[]): RateVerdict {
  const byDate = new Map(rows.map((r) => [r.date, r]))
  const days = nights.map((n) => byDate.get(n))
  const present = days.filter((d): d is ClockAvailabilityRow => d !== undefined)

  const first = present[0]
  const currency = first?.currency ?? ''
  const pricePerNight = first?.price_cents != null ? first.price_cents / 100 : 0
  const complete = present.length === nights.length

  const availableRooms = complete
    ? Math.min(...present.map((d) => d.free_rooms ?? 0))
    : 0

  const base = { rateId: rows[0].clock_rate_id, pricePerNight, currency, availableRooms }

  // Ordered by what the guest can act on. A stopped sale is final; a minimum
  // stay is an invitation to change the dates.
  if (present.some((d) => d.stop_from_sale)) return { ...base, availableRooms: 0, restriction: 'stop_from_sale' }
  if (present[0]?.closed_for_arrival) return { ...base, availableRooms: 0, restriction: 'closed_for_arrival' }

  const minStay = Math.max(0, ...present.map((d) => d.min_stay ?? 0))
  if (minStay > nights.length) return { ...base, availableRooms: 0, restriction: `min_stay:${minStay}` }

  if (!complete || !present.every((d) => d.free) || availableRooms <= 0) {
    return { ...base, availableRooms: 0, restriction: 'sold_out' }
  }

  return base
}

export function makeClockProvider(
  supabase: SupabaseClient,
  config: ClockTenantConfig,
): InventoryProvider {
  return {
    async availability(checkIn: string, checkOut: string, _guests: GuestCount): Promise<AvailabilityResult> {
      // Guest counts are priced into the cache when it is refreshed. They are
      // accepted here so both providers answer the same call.
      void _guests

      const nights = nightsBetween(checkIn, checkOut)
      if (nights.length === 0) return { offers: [], staleMinutes: null }

      const lastNight = nights[nights.length - 1]
      const { data, error } = await supabase
        .from('clock_availability_cache')
        .select('*')
        .eq('tenant_id', config.tenantId)
        .gte('date', nights[0])
        .lte('date', lastNight)

      if (error) {
        console.error('[clock.availability] cache read failed:', error.message)
        return { offers: [], staleMinutes: null }
      }

      const rows = (data ?? []) as ClockAvailabilityRow[]
      if (rows.length === 0) return { offers: [], staleMinutes: null }

      const oldest = rows.reduce(
        (acc, r) => Math.min(acc, new Date(r.fetched_at).getTime()),
        Number.POSITIVE_INFINITY,
      )
      const staleMinutes = Number.isFinite(oldest)
        ? Math.floor((Date.now() - oldest) / 60_000)
        : null

      // room type -> rate -> its nights
      const byType = new Map<number, { name: string | null; rates: Map<number, ClockAvailabilityRow[]> }>()
      for (const r of rows) {
        const type = byType.get(r.clock_room_type_id)
          ?? { name: r.room_type_name, rates: new Map<number, ClockAvailabilityRow[]>() }
        const rate = type.rates.get(r.clock_rate_id) ?? []
        rate.push(r)
        type.rates.set(r.clock_rate_id, rate)
        byType.set(r.clock_room_type_id, type)
      }

      const offers: RoomOffer[] = []
      for (const [roomTypeId, type] of byType) {
        const verdicts = [...type.rates.values()].map((rateRows) => judgeRate(rateRows, nights))
        const bookable = verdicts
          .filter((v) => !v.restriction && v.availableRooms > 0)
          .sort((a, b) => a.pricePerNight - b.pricePerNight)

        // Nothing bookable: keep one verdict so the agent can say why rather
        // than dropping the room type out of the conversation entirely.
        const chosen = bookable[0] ?? verdicts[0]
        if (!chosen) continue

        offers.push({
          id: String(roomTypeId),
          name: type.name ?? String(roomTypeId),
          pricePerNight: chosen.pricePerNight,
          currency: chosen.currency,
          availableRooms: chosen.availableRooms,
          ...(chosen.restriction ? { restriction: chosen.restriction } : {}),
        })
      }

      return { offers, staleMinutes }
    },

    async createBooking(_req: BookingRequest): Promise<BookingResult> {
      // Task 10.
      void _req
      throw new Error('not implemented yet')
    },
  }
}
