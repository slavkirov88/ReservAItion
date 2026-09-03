import { makeClockProvider } from './clock'
import type { ClockTenantConfig } from '@/lib/clock/config'

const config: ClockTenantConfig = {
  tenantId: 'tenant-1',
  creds: { baseUrl: 'https://sky-eu1.clock-software.com/pms_api/1/2', apiUser: 'u', apiKey: 'k' },
  rateIds: [799198, 799205],
  roomTypeIds: [],
  sandbox: true,
}

type Row = Record<string, unknown>

/** Supabase stand-in: the availability path only ever reads the cache table. */
function fakeSupabase(rows: Row[]) {
  const chain: Record<string, unknown> = {}
  const self = () => chain
  chain.select = self
  chain.eq = self
  chain.gte = self
  chain.lte = self
  chain.then = (resolve: (v: unknown) => unknown) => resolve({ data: rows, error: null })
  return { from: () => chain }
}

const fresh = new Date().toISOString()

const row = (over: Row = {}): Row => ({
  tenant_id: 'tenant-1',
  clock_room_type_id: 42414,
  room_type_name: 'DBL',
  clock_rate_id: 799198,
  date: '2026-09-12',
  free: true,
  price_cents: 8000,
  currency: 'BGN',
  free_rooms: 4,
  min_stay: null,
  closed_for_arrival: false,
  stop_from_sale: false,
  fetched_at: fresh,
  ...over,
})

const twoNights = [row(), row({ date: '2026-09-13', price_cents: 7500, free_rooms: 2 })]

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const provider = (rows: Row[]) => makeClockProvider(fakeSupabase(rows) as any, config)

const guests = { adults: 2, children: 0, childrenAges: null }

test('offers a room type whose every night is free', async () => {
  const { offers } = await provider(twoNights).availability('2026-09-12', '2026-09-14', guests)

  expect(offers).toHaveLength(1)
  expect(offers[0]).toMatchObject({
    id: '42414',
    name: 'DBL',
    currency: 'BGN',
    pricePerNight: 80,
    // The night with the fewest rooms decides what can be promised.
    availableRooms: 2,
  })
  expect(offers[0].restriction).toBeUndefined()
})

test('a night missing from the cache is not treated as free', async () => {
  const { offers } = await provider([row()]).availability('2026-09-12', '2026-09-14', guests)
  expect(offers[0].availableRooms).toBe(0)
  expect(offers[0].restriction).toBe('sold_out')
})

test('a min_stay longer than the stay becomes the reason, not a silent no', async () => {
  const rows = twoNights.map((r) => ({ ...r, min_stay: 3 }))
  const { offers } = await provider(rows).availability('2026-09-12', '2026-09-14', guests)
  expect(offers[0].restriction).toBe('min_stay:3')
})

test('a min_stay the guest already meets is not a restriction', async () => {
  const rows = twoNights.map((r) => ({ ...r, min_stay: 2 }))
  const { offers } = await provider(rows).availability('2026-09-12', '2026-09-14', guests)
  expect(offers[0].restriction).toBeUndefined()
})

test('a closed arrival day is named as such', async () => {
  const rows = [row({ closed_for_arrival: true }), twoNights[1]]
  const { offers } = await provider(rows).availability('2026-09-12', '2026-09-14', guests)
  expect(offers[0].restriction).toBe('closed_for_arrival')
})

test('a stopped sale beats every other reason', async () => {
  const rows = twoNights.map((r) => ({ ...r, free: false, stop_from_sale: true }))
  const { offers } = await provider(rows).availability('2026-09-12', '2026-09-14', guests)
  expect(offers[0].restriction).toBe('stop_from_sale')
})

test('the cheapest fully free rate wins', async () => {
  const cheap = twoNights.map((r) => ({ ...r, clock_rate_id: 799205, price_cents: 5000 }))
  const { offers } = await provider([...twoNights, ...cheap]).availability('2026-09-12', '2026-09-14', guests)
  expect(offers).toHaveLength(1)
  expect(offers[0].pricePerNight).toBe(50)
})

test('reports how old the cache is', async () => {
  const old = new Date(Date.now() - 90 * 60_000).toISOString()
  const rows = twoNights.map((r) => ({ ...r, fetched_at: old }))
  const { staleMinutes } = await provider(rows).availability('2026-09-12', '2026-09-14', guests)
  expect(staleMinutes).toBeGreaterThanOrEqual(89)
})

test('an empty cache offers nothing instead of guessing', async () => {
  const { offers, staleMinutes } = await provider([]).availability('2026-09-12', '2026-09-14', guests)
  expect(offers).toEqual([])
  expect(staleMinutes).toBeNull()
})

// A guest who says "tonight only" with no departure still gets an answer.
test('a missing check-out is read as one night', async () => {
  const { offers } = await provider([row()]).availability('2026-09-12', '2026-09-12', guests)
  expect(offers[0].availableRooms).toBe(4)
})

// ---------------------------------------------------------------------------
// Writing: the part that puts a real booking in someone else's hotel.
// ---------------------------------------------------------------------------

import { ClockBannedError } from '@/lib/clock/client'
import type { BookingRequest } from './types'

const bookingRequest: BookingRequest = {
  guestName: 'Иван Иванов',
  guestPhone: '+359888123456',
  guestEmail: null,
  checkIn: '2026-09-12',
  checkOut: '2026-09-14',
  roomTypeRef: 'DBL',
  guests: { adults: 2, children: 1, childrenAges: '5 години' },
  callId: 'call-abc',
}

const products = [{
  type: 'Pms::RoomType',
  id: 42414,
  rates: {
    '799198': [{ room_type_free_rooms: 3, available: true, price: { cents: 16000, currency: 'BGN' }, errors: {} }],
    '799205': [{ room_type_free_rooms: 3, available: true, price: { cents: 12000, currency: 'BGN' }, errors: {} }],
  },
}]

/** Cache rows plus a booking log, with the writes recorded. */
function fakeDb(options: { logRow?: Row | null; cache?: Row[] } = {}) {
  const inserts: Record<string, unknown[]> = {}

  const table = (name: string) => {
    const chain: Record<string, unknown> = {}
    const self = () => chain
    chain.select = self
    chain.eq = self
    chain.gte = self
    chain.lte = self
    chain.maybeSingle = async () => ({ data: options.logRow ?? null, error: null })
    chain.single = async () => ({ data: null, error: null })
    chain.insert = async (r: unknown) => { (inserts[name] ??= []).push(r); return { error: null } }
    chain.then = (resolve: (v: unknown) => unknown) =>
      resolve({ data: name === 'clock_availability_cache' ? (options.cache ?? twoNights) : [], error: null })
    return chain
  }

  return { from: (name: string) => table(name), inserted: (t: string) => inserts[t] ?? [] }
}

const writeDeps = (over: Record<string, unknown> = {}) => ({
  getProducts: jest.fn(async () => products),
  searchGuests: jest.fn(async () => []),
  createClockBooking: jest.fn(async () => ({ id: 38065670 })),
  fallback: { createBooking: jest.fn(async () => ({ ok: true, ref: 'row-1', source: 'own', spokenResult: 'ok' })) },
  notifyOwner: jest.fn(),
  ...over,
})

test('a repeated tool call returns the first booking instead of making a second', async () => {
  const deps = writeDeps()
  const db = fakeDb({ logRow: { clock_booking_id: '38065670' } })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = await makeClockProvider(db as any, config, deps as any).createBooking(bookingRequest)

  expect(result.ok).toBe(true)
  expect(result.ref).toBe('38065670')
  expect(deps.createClockBooking).not.toHaveBeenCalled()
})

test('books the cheapest available rate and remembers the call', async () => {
  const deps = writeDeps()
  const db = fakeDb()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = await makeClockProvider(db as any, config, deps as any).createBooking(bookingRequest)

  expect(result.ok).toBe(true)
  expect(result.ref).toBe('38065670')
  expect(result.source).toBe('clock')
  const body = (deps.createClockBooking.mock.calls[0] as unknown[])[1] as { booking: Record<string, unknown> }
  expect(body.booking.rate_id).toBe(799205)
  expect(body.booking.arrival_room_type_id).toBe(42414)
  expect(db.inserted('clock_booking_log')).toHaveLength(1)
})

test('an existing guest profile is reused instead of duplicated', async () => {
  const deps = writeDeps({ searchGuests: jest.fn(async () => [{ id: 165099991 }]) })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await makeClockProvider(fakeDb() as any, config, deps as any).createBooking(bookingRequest)

  const body = (deps.createClockBooking.mock.calls[0] as unknown[])[1] as Record<string, unknown>
  expect(body.main_booking_guest).toBe(165099991)
  expect(deps.searchGuests).toHaveBeenCalledWith(expect.anything(), '+359888123456')
})

test('nothing available means nothing is promised', async () => {
  const deps = writeDeps({ getProducts: jest.fn(async () => [{ type: 'Pms::RoomType', id: 42414, rates: {} }]) })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = await makeClockProvider(fakeDb() as any, config, deps as any).createBooking(bookingRequest)

  expect(result.ok).toBe(false)
  expect(deps.createClockBooking).not.toHaveBeenCalled()
  expect(result.spokenResult).not.toContain('Готово')
})

// A ban lasts two hours. Retrying extends it, and the guest must not wait.
test('a ban falls back to our own row and warns the owner', async () => {
  const deps = writeDeps({
    createClockBooking: jest.fn(async () => { throw new ClockBannedError('banned') }),
  })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = await makeClockProvider(fakeDb() as any, config, deps as any).createBooking(bookingRequest)

  expect(deps.fallback.createBooking).toHaveBeenCalledTimes(1)
  expect(deps.notifyOwner).toHaveBeenCalledTimes(1)
  expect(result.ok).toBe(true)
  expect(result.source).toBe('own')
  expect(result.spokenResult).toMatch(/рецепцията/i)
})

test('a timeout is never read out as a confirmed booking', async () => {
  const deps = writeDeps({
    createClockBooking: jest.fn(async () => { throw new Error('The operation was aborted due to timeout') }),
  })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = await makeClockProvider(fakeDb() as any, config, deps as any).createBooking(bookingRequest)

  expect(deps.fallback.createBooking).toHaveBeenCalledTimes(1)
  expect(result.spokenResult).toMatch(/рецепцията/i)
  expect(result.ref).toBeNull()
})

test('a booking the PMS did not number is not a booking', async () => {
  const deps = writeDeps({ createClockBooking: jest.fn(async () => ({})) })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = await makeClockProvider(fakeDb() as any, config, deps as any).createBooking(bookingRequest)

  expect(result.ref).toBeNull()
  expect(result.spokenResult).not.toContain('Готово')
  expect(deps.fallback.createBooking).toHaveBeenCalledTimes(1)
})
