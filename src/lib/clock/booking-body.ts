// ---------------------------------------------------------------------------
// The body of a Clock `booking` CREATE.
//
// Proven against the sandbox on 30.08.2026: booking 38065670 was created with
// a first name and a phone number only. Clock built the guest profile itself,
// so the agent does not have to ask a caller for an email address.
//
// The one thing Clock will not do without is a rate. Their availability check
// runs on create and this API user has no "Rate Availability Control Override"
// right, which is the reason a stale cache on our side cannot overbook a
// hotel. The rate id therefore comes from `products`, seconds earlier, and a
// missing one is refused here rather than 400-ing mid call.
// ---------------------------------------------------------------------------

/** Written into the booking so the hotel can tell at a glance where it came from. */
export const AI_BOOKING_NOTE = 'Направена от ReservAItion (телефонен AI рецепционист).'

export interface BookingBodyInput {
  arrival: string
  departure: string
  roomTypeId: number | null
  rateId: number | null
  adults: number | null
  children: number | null
  firstName: string
  lastName: string | null
  phone: string
  email: string | null
  /** Existing Clock guest id, when the search found one. */
  mainBookingGuestId: string | number | null
  /** The Vapi call id, so a booking can be traced back to its conversation. */
  referenceNumber: string | null
}

export function buildBookingBody(input: BookingBodyInput): Record<string, unknown> {
  if (!input.rateId) {
    throw new Error('Clock refuses a booking without a rate id, and this API user cannot override availability')
  }
  if (!input.roomTypeId) {
    throw new Error('Clock needs a room type id for the arrival')
  }

  const booking: Record<string, unknown> = {
    arrival: input.arrival,
    departure: input.departure,
    status: 'expected',
    arrival_room_type_id: input.roomTypeId,
    rate_id: input.rateId,
    adults: input.adults ?? 1,
    children: input.children ?? 0,
    marketing_source: 'Phone',
    note: AI_BOOKING_NOTE,
    guest_first_name: input.firstName,
  }

  // Empty strings are not neutral in their system: they overwrite. Fields the
  // guest did not give are left out entirely.
  if (input.lastName) booking.guest_last_name = input.lastName
  if (input.phone) booking.guest_phone_number = input.phone
  if (input.email) booking.guest_e_mail = input.email
  if (input.referenceNumber) booking.reference_number = input.referenceNumber

  const body: Record<string, unknown> = { booking }

  // Top level, not inside `booking`. Their contract puts it there, and a known
  // guest id is what stops a returning caller becoming a second profile in the
  // hotel's own database.
  if (input.mainBookingGuestId != null) body.main_booking_guest = input.mainBookingGuestId

  return body
}
