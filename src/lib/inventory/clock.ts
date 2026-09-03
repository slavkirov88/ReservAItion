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
import { assertWritable, type ClockTenantConfig } from '@/lib/clock/config'
import type { ClockAvailabilityRow } from '@/lib/clock/availability-map'
import { ClockBannedError } from '@/lib/clock/client'
import { createBooking as clockCreateBooking, getProducts, searchGuests, type ClockProductEntry } from '@/lib/clock/voice'
import { buildBookingBody } from '@/lib/clock/booking-body'
import { parseChildrenAges } from '@/lib/clock/children-ages'
import { makeOwnProvider } from './own'
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

/** What the agent says when the PMS could not be reached. It never claims a booking. */
const FALLBACK_SPOKEN =
  'Записах заявката Ви. Рецепцията ще потвърди резервацията и ще се свърже с Вас.'

const addOneDay = (date: string) =>
  new Date(new Date(`${date}T00:00:00Z`).getTime() + MS_PER_DAY).toISOString().slice(0, 10)

/** "Иван Иванов Петров" -> first name, everything else as the family name. */
export function splitName(full: string): [string, string | null] {
  const parts = full.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return ['Гост', null]
  return [parts[0], parts.slice(1).join(' ') || null]
}

/**
 * The room type the guest meant, in Clock's numbering.
 *
 * The agent passes back whatever it offered, which is either the id we gave it
 * or the name the guest repeated. Both are accepted; nothing is guessed when
 * neither matches, because booking the wrong room type is worse than asking
 * the question again.
 */
export function resolveRoomType(ref: string | null, offers: RoomOffer[]): number | null {
  if (offers.length === 0) return null
  if (!ref) return offers.length === 1 ? Number(offers[0].id) : null

  const needle = ref.trim().toLowerCase()
  const match = offers.find((o) => o.id === ref.trim())
    ?? offers.find((o) => o.name.trim().toLowerCase() === needle)
    ?? offers.find((o) => o.name.trim().toLowerCase().includes(needle))

  return match ? Number(match.id) : null
}

/**
 * The cheapest rate Clock reports as free for this room type, right now.
 *
 * Their answer, not our cache, decides. A rate taken from a cache a few
 * minutes old is refused on create, and the refusal arrives while the guest is
 * still on the line.
 */
export function cheapestAvailableRate(products: ClockProductEntry[], roomTypeId: number): number | null {
  const entry = (products ?? []).find((p) => p.id === roomTypeId)
  if (!entry) return null

  let best: { rateId: number; cents: number } | null = null
  for (const [rateId, options] of Object.entries(entry.rates ?? {})) {
    for (const option of options ?? []) {
      if (option?.available !== true || option.price?.cents == null) continue
      if (!best || option.price.cents < best.cents) best = { rateId: Number(rateId), cents: option.price.cents }
    }
  }
  return best?.rateId ?? null
}

export interface ClockProviderDeps {
  getProducts: typeof getProducts
  searchGuests: typeof searchGuests
  createClockBooking: typeof clockCreateBooking
  /** Where a booking goes when Clock cannot take it. Today's behaviour. */
  fallback: Pick<InventoryProvider, 'createBooking'>
  notifyOwner: (config: ClockTenantConfig, error: unknown) => Promise<void> | void
}

export function makeClockProvider(
  supabase: SupabaseClient,
  config: ClockTenantConfig,
  overrides: Partial<ClockProviderDeps> = {},
): InventoryProvider {
  const fallbackProvider = overrides.fallback ?? makeOwnProvider(supabase, config.tenantId)
  const deps: ClockProviderDeps = {
    getProducts,
    searchGuests,
    createClockBooking: clockCreateBooking,
    fallback: fallbackProvider,
    // Sprint 1 builds no new alert channel on purpose: the fallback already
    // emails the owner the guest's request, and this line is what tells us
    // the PMS was the reason.
    notifyOwner: () => {},
    ...overrides,
  }

  const availability = async (checkIn: string, checkOut: string, _guests: GuestCount): Promise<AvailabilityResult> => {
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
  }

  return {
    availability,


    async createBooking(req: BookingRequest): Promise<BookingResult> {
      // 1. The same call twice is the same booking once.
      //
      // Vapi retries a tool call it believes timed out. Without this the guest
      // ends up twice in the hotel's PMS and we hear about it from the hotel.
      if (req.callId) {
        const { data: seen } = await supabase
          .from('clock_booking_log')
          .select('clock_booking_id')
          .eq('tenant_id', config.tenantId)
          .eq('vapi_call_id', req.callId)
          .maybeSingle()

        if (seen?.clock_booking_id) {
          return {
            ok: true,
            ref: String(seen.clock_booking_id),
            source: 'clock',
            spokenResult: `Резервацията вече е записана, номер ${seen.clock_booking_id}.`,
          }
        }
      }

      const fallback = async (spoken: string): Promise<BookingResult> => {
        const result = await fallbackProvider.createBooking(req)
        return { ...result, ref: null, source: 'own', spokenResult: spoken }
      }

      try {
        // 2. Which room type the guest asked for, in Clock's numbering.
        const { offers } = await availability(req.checkIn, req.checkOut ?? req.checkIn, req.guests)
        const roomTypeId = resolveRoomType(req.roomTypeRef, offers)
        if (roomTypeId === null) {
          return {
            ok: false,
            ref: null,
            source: 'clock',
            spokenResult: 'Не разбрах кой тип стая желаете. Може ли да го повторите?',
          }
        }

        // 3. The one live check. The rate comes from what Clock reports free
        //    right now, never from our cache: their availability check runs on
        //    create and this user cannot override it.
        const departure = req.checkOut ?? addOneDay(req.checkIn)
        const productList = await deps.getProducts(config.creds, {
          arrival: req.checkIn,
          departure,
          rateIds: config.rateIds,
          adults: req.guests.adults,
          children: req.guests.children,
          childrenAges: parseChildrenAges(req.guests.childrenAges),
        })

        const rateId = cheapestAvailableRate(productList, roomTypeId)
        if (rateId === null) {
          return {
            ok: false,
            ref: null,
            source: 'clock',
            spokenResult: 'За тези дати системата на хотела не показва свободна стая от този тип. Да проверя ли други дати?',
          }
        }

        // 4. A returning guest keeps their profile. Skipping this fills the
        //    hotel's database with duplicates, which they notice immediately.
        const [firstName, lastName] = splitName(req.guestName)
        const found = await deps.searchGuests(config.creds, req.guestPhone)
        const guest = found[0] ?? (await deps.searchGuests(config.creds, req.guestName))[0]

        const body = buildBookingBody({
          arrival: req.checkIn,
          departure,
          roomTypeId,
          rateId,
          adults: req.guests.adults,
          children: req.guests.children,
          firstName,
          lastName,
          phone: req.guestPhone,
          email: req.guestEmail,
          mainBookingGuestId: guest?.id ?? null,
          referenceNumber: req.callId,
        })

        assertWritable(config)
        const created = await deps.createClockBooking(config.creds, body) as
          { id?: number | string; booking?: { id?: number | string } }

        const bookingId = created?.id ?? created?.booking?.id
        if (bookingId == null) {
          // No number, no booking. Saying "готово" here is the failure mode
          // this whole file exists to avoid.
          console.error('[clock.createBooking] Clock answered without a booking id')
          return fallback(FALLBACK_SPOKEN)
        }

        if (req.callId) {
          await supabase.from('clock_booking_log').insert({
            tenant_id: config.tenantId,
            vapi_call_id: req.callId,
            clock_booking_id: String(bookingId),
          })
        }

        return {
          ok: true,
          ref: String(bookingId),
          source: 'clock',
          spokenResult: `Готово! Резервацията е записана в системата на хотела, номер ${bookingId}.`,
        }
      } catch (err) {
        if (err instanceof ClockBannedError) {
          // Their WAF bans an IP for two hours and retrying extends it.
          console.error(`[CLOCK BANNED] tenant ${config.tenantId}:`, err.message)
          await deps.notifyOwner(config, err)
          return fallback(FALLBACK_SPOKEN)
        }

        const message = err instanceof Error ? err.message : String(err)
        console.error(`[clock.createBooking] tenant ${config.tenantId}:`, message)
        await deps.notifyOwner(config, err)
        return fallback(FALLBACK_SPOKEN)
      }
    },
  }
}
