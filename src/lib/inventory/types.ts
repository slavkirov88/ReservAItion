// ---------------------------------------------------------------------------
// One shape for "what can this hotel sell", whoever owns the inventory.
//
// `own` is the rooms in our own database, which is every tenant today. `clock`
// is a hotel whose PMS holds the truth. The Vapi route must not be able to
// tell which one it is talking to.
// ---------------------------------------------------------------------------

export interface GuestCount {
  adults: number | null
  children: number | null
  /** As the agent heard it, e.g. "5 и 8 години". Converted at the Clock edge. */
  childrenAges: string | null
}

export interface RoomOffer {
  /** Our uuid for own inventory, the Clock room type id as a string for Clock. */
  id: string
  name: string
  /** Whole units, not cents. */
  pricePerNight: number
  /**
   * 'EUR' for our own rooms, 'BGN' in the Clock sandbox.
   *
   * Never assumed and never converted. An agent that says "eighty euro" for an
   * eighty lev room is worse than an agent that says nothing.
   */
  currency: string
  availableRooms: number
  capacity?: number
  /** Why these dates do not work, when they do not. Machine readable, e.g. `min_stay:2`. */
  restriction?: string
}

export interface BookingRequest {
  guestName: string
  guestPhone: string
  guestEmail: string | null
  checkIn: string
  checkOut: string | null
  /** Room type as the guest named it, or the provider's own id. */
  roomTypeRef: string | null
  guests: GuestCount
  /** Vapi call id. The idempotency key for Clock; unused by own inventory. */
  callId: string | null
}

export interface BookingResult {
  ok: boolean
  /** Booking number from the PMS, or our row id. Null when nothing was created. */
  ref: string | null
  source: 'own' | 'clock'
  /** What the agent says out loud, in Bulgarian. */
  spokenResult: string
}

export interface AvailabilityResult {
  offers: RoomOffer[]
  /**
   * Age of the answer in minutes, or null when it is live.
   *
   * The Clock provider reads a cache, and how old that cache is changes what
   * the agent is allowed to promise. The formatter needs it, so it travels
   * with the offers rather than being looked up a second time.
   */
  staleMinutes: number | null
}

export interface InventoryProvider {
  availability(checkIn: string, checkOut: string, guests: GuestCount): Promise<AvailabilityResult>
  createBooking(req: BookingRequest): Promise<BookingResult>
}
