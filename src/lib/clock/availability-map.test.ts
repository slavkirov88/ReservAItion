import fs from 'node:fs'
import path from 'node:path'
import { toCacheRows } from './availability-map'
import type { ClockAvailabilityEntry } from './voice'

// The real answer from the sandbox on 30.08.2026, not a hand-written sample.
const fixture = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), 'docs/superpowers/fixtures/rates_availability.json'), 'utf8'),
) as ClockAvailabilityEntry[]

test('carries the currency through instead of assuming euro', () => {
  const rows = toCacheRows('tenant-1', fixture)
  expect(rows[0].currency).toBe('BGN')
  expect(rows[0].price_cents).toBe(8000)
})

test('one row per room type, rate and date', () => {
  const rows = toCacheRows('tenant-1', fixture)
  expect(rows.length).toBeGreaterThan(0)
  expect(rows[0].tenant_id).toBe('tenant-1')
  expect(rows[0].clock_room_type_id).toBe(42416)
  expect(rows[0].clock_rate_id).toBe(799198)
  expect(rows[0].date).toBe('2026-09-06')
  const keys = rows.map((r) => `${r.clock_room_type_id}:${r.clock_rate_id}:${r.date}`)
  expect(new Set(keys).size).toBe(rows.length)
})

test('the room type name is filled in from the name map', () => {
  const rows = toCacheRows('tenant-1', fixture, { 42416: 'APP' })
  expect(rows[0].room_type_name).toBe('APP')
})

const day = (over: Record<string, unknown>) => ([{
  type: 'Pms::RoomType',
  id: 42414,
  rates: {
    '799198': {
      '2026-09-06': {
        resource_id: 42414,
        rate_id: 799198,
        date: '2026-09-06',
        free: true,
        price: { currency: 'BGN', cents: 12000 },
        room_type_free_rooms: 3,
        errors: null,
        rate_restriction: {},
        ...over,
      },
    },
  },
}] as unknown as ClockAvailabilityEntry[])

test('a stop_from_sale day is not free even when rooms are left', () => {
  const rows = toCacheRows('tenant-1', day({ rate_restriction: { stop_from_sale: true } }))
  expect(rows[0].free).toBe(false)
  expect(rows[0].stop_from_sale).toBe(true)
  expect(rows[0].free_rooms).toBe(3)
})

test('min_stay is carried through so the agent can say why', () => {
  const rows = toCacheRows('tenant-1', day({ rate_restriction: { min_stay: 2 } }))
  expect(rows[0].min_stay).toBe(2)
  expect(rows[0].free).toBe(true)
})

test('close_for_arrival is kept apart from a plain sold-out day', () => {
  const rows = toCacheRows('tenant-1', day({ rate_restriction: { close_for_arrival: true } }))
  expect(rows[0].closed_for_arrival).toBe(true)
})

// A day priced null is a day we cannot quote. Writing zero would have the
// agent offer the room for nothing.
test('a missing price stays missing, it does not become zero', () => {
  const rows = toCacheRows('tenant-1', day({ price: null }))
  expect(rows[0].price_cents).toBeNull()
  expect(rows[0].currency).toBeNull()
})

test('an empty response maps to no rows rather than throwing', () => {
  expect(toCacheRows('tenant-1', [])).toEqual([])
  expect(toCacheRows('tenant-1', undefined as unknown as ClockAvailabilityEntry[])).toEqual([])
})
