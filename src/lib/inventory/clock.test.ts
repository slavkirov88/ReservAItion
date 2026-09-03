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
