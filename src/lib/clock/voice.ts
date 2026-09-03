// ---------------------------------------------------------------------------
// The four calls the `voice` API user is allowed to make.
//
// Every query string here was verified against the sandbox on 30.08.2026. The
// documentation is wrong or silent about three of them, so the shapes are kept
// close to the wire rather than tidied up:
//
//   - `room_types` is REQUIRED for rates_availability, though it is written up
//     as optional. Without it Clock answers 400 with `contract.filled?`.
//   - array parameters must repeat (`rates[]=1&rates[]=2`), never comma-join.
//   - `products` puts its parameters inside brackets, and they must be sent
//     that way rather than "corrected" into plain names.
// ---------------------------------------------------------------------------

import { clockGet, clockPost, type ClockCredentials } from './client'

/** Free-text guest search below this length answers 500, not 400. */
const MIN_GUEST_SEARCH_LENGTH = 3

export interface ClockRoomType {
  id: number
  name: string
  is_virtual?: boolean
  components_room_type_ids?: number[]
}

export interface ClockRate {
  id: number
  name?: string
}

export interface ClockPrice {
  cents: number
  currency: string
}

export interface ClockRateRestriction {
  min_stay: number | null
  max_stay: number | null
  min_stay_on_arrival: number | null
  close_for_arrival: boolean
  close_for_departure: boolean
  stop_from_sale: boolean
  max_adults: number | null
  max_children: number | null
}

export interface ClockAvailabilityDay {
  resource_id: number
  rate_id: number
  date: string
  free: boolean
  price: ClockPrice | null
  room_type_free_rooms: number | null
  errors: unknown
  rate_restriction: Partial<ClockRateRestriction> | null
}

/** `[{ id: 42416, rates: { "799198": { "2026-09-06": day } } }]` */
export interface ClockAvailabilityEntry {
  type: string
  id: number
  rates: Record<string, Record<string, ClockAvailabilityDay>>
}

/** Same nesting as availability, but a list per rate and no dates. */
export interface ClockProductEntry {
  type: string
  id: number
  rates: Record<string, Array<{
    room_type_free_rooms: number | null
    available: boolean
    price: ClockPrice | null
    errors: unknown
  }>>
}

export interface ClockGuest {
  id: number
  first_name?: string
  last_name?: string
  e_mail?: string
  phone_number?: string
}

export interface GuestParams {
  adults?: number | null
  children?: number | null
  childrenAges?: number[]
}

/**
 * Guest counts belong on both read calls.
 *
 * A rate priced per person is computed from them. Leaving them out returns a
 * number that looks plausible and is wrong, which is the worst kind.
 */
function guestQuery(guests: GuestParams) {
  return {
    adults: guests.adults ?? undefined,
    children: guests.children ?? undefined,
  }
}

export async function getRoomTypes(creds: ClockCredentials): Promise<ClockRoomType[]> {
  return clockGet<ClockRoomType[]>(creds, 'room_types')
}

export async function getRates(creds: ClockCredentials): Promise<ClockRate[]> {
  return clockGet<ClockRate[]>(creds, 'rates')
}

/**
 * Their heaviest endpoint, and the one behind our cache.
 *
 * Clock's own guidance is to call it every 15-20 minutes and cache the answer.
 * It is never called while a guest is on the line.
 */
export async function getRatesAvailability(
  creds: ClockCredentials,
  args: {
    from: string
    to: string
    rateIds: number[]
    roomTypeIds: number[]
    adults?: number | null
    children?: number | null
    childrenAges?: number[]
  },
): Promise<ClockAvailabilityEntry[]> {
  if (args.rateIds.length === 0) throw new Error('rates_availability needs at least one rate id')
  if (args.roomTypeIds.length === 0) throw new Error('rates_availability needs at least one room type id')

  return clockGet<ClockAvailabilityEntry[]>(creds, 'rates_availability', {
    query: { from: args.from, to: args.to, ...guestQuery(args) },
    repeated: {
      'rates[]': args.rateIds,
      'room_types[]': args.roomTypeIds,
      'children_ages[]': args.childrenAges ?? [],
    },
  })
}

/**
 * The one live check, made once, immediately before creating a booking.
 *
 * This is where the rate id comes from. Clock enforces availability on create
 * and this user cannot override it, so a rate chosen from our own cache would
 * be refused the moment the cache is a few minutes old.
 */
export async function getProducts(
  creds: ClockCredentials,
  args: {
    arrival: string
    departure: string
    rateIds: number[]
    adults?: number | null
    children?: number | null
    childrenAges?: number[]
  },
): Promise<ClockProductEntry[]> {
  if (args.rateIds.length === 0) throw new Error('products needs at least one rate id')

  const guests = guestQuery(args)
  return clockGet<ClockProductEntry[]>(creds, 'products', {
    trailingSlash: false,
    query: {
      'product_search[arrival]': args.arrival,
      'product_search[departure]': args.departure,
      'product_search[adult_count]': guests.adults,
      'product_search[children_count]': guests.children,
    },
    repeated: {
      'rates[]': args.rateIds,
      'product_search[children_ages][]': args.childrenAges ?? [],
    },
  })
}

/**
 * Looks for an existing guest profile before a new one is created.
 *
 * Skipping this makes a second profile for every returning guest. The hotel
 * sees the duplicates before it sees any of the benefits, and that is what
 * ends a pilot.
 *
 * Returns an empty list for input Clock would reject, rather than throwing
 * mid-call: not finding a guest is a normal outcome here.
 */
export async function searchGuests(
  creds: ClockCredentials,
  freeText: string | null | undefined,
): Promise<ClockGuest[]> {
  const term = (freeText ?? '').trim()
  if (term.length < MIN_GUEST_SEARCH_LENGTH) return []

  const result = await clockGet<ClockGuest[] | { error: string }>(creds, 'guests/search', {
    trailingSlash: false,
    query: { free_text_search: term },
  })
  return Array.isArray(result) ? result : []
}

export async function createBooking<T = unknown>(
  creds: ClockCredentials,
  body: unknown,
): Promise<T> {
  return clockPost<T>(creds, 'bookings', body)
}
