import { formatAvailabilityBg } from '@/lib/availability'
import { formatOffersBg } from './format-bg'
import type { RoomOffer } from './types'

// The guest on the live demo hears whatever this function returns. Nothing may
// change for a hotel that is not on Clock, so the first test is byte for byte.
test('matches todays wording exactly when nothing is restricted', () => {
  const legacy = formatAvailabilityBg(
    [{ id: 'a', name: 'Студио', description: null, capacity: 2, price_per_night: 88, total_rooms: 3, available_rooms: 2 }],
    '2026-09-12', '2026-09-14',
  )
  const next = formatOffersBg(
    [{ id: 'a', name: 'Студио', pricePerNight: 88, currency: 'EUR', availableRooms: 2, capacity: 2 }],
    '2026-09-12', '2026-09-14',
  )
  expect(next).toBe(legacy)
})

test('an empty list matches todays wording too', () => {
  expect(formatOffersBg([], '2026-09-12', '2026-09-14'))
    .toBe(formatAvailabilityBg([], '2026-09-12', '2026-09-14'))
})

test('says the reason when a restriction blocks the dates', () => {
  const text = formatOffersBg(
    [{ id: '1', name: 'Двойна', pricePerNight: 120, currency: 'BGN', availableRooms: 0, restriction: 'min_stay:2' }],
    '2026-09-12', '2026-09-13',
  )
  expect(text).toContain('минималният престой')
  expect(text).toContain('2')
})

test('warns when the cache is stale', () => {
  const text = formatOffersBg([], '2026-09-12', '2026-09-14', { staleMinutes: 90 })
  expect(text).toContain('рецепцията')
})

test('a fresh cache adds no warning', () => {
  expect(formatOffersBg([], '2026-09-12', '2026-09-14', { staleMinutes: 12 }))
    .toBe(formatOffersBg([], '2026-09-12', '2026-09-14'))
})

// The sandbox prices in lev. An agent saying "euro" over a lev price is the
// one mistake a hotel cannot forgive.
test('says lev when Clock answered in lev', () => {
  const offer: RoomOffer = { id: '42414', name: 'DBL', pricePerNight: 80, currency: 'BGN', availableRooms: 4 }
  const text = formatOffersBg([offer], '2026-09-12', '2026-09-14')
  expect(text).toContain('80 лв./нощ')
  expect(text).not.toContain('€')
})

test('leaves out the capacity when the PMS did not give one', () => {
  const text = formatOffersBg(
    [{ id: '42414', name: 'DBL', pricePerNight: 80, currency: 'BGN', availableRooms: 4 }],
    '2026-09-12', '2026-09-14',
  )
  expect(text).not.toContain('гости')
  expect(text).toContain('Двойна стая (код DBL): 4 свободна/и, 80 лв./нощ')
})

test('a sold out type is named as sold out, not silently dropped', () => {
  const text = formatOffersBg(
    [{ id: '1', name: 'Апартамент', pricePerNight: 200, currency: 'BGN', availableRooms: 0, restriction: 'sold_out' }],
    '2026-09-12', '2026-09-14',
  )
  expect(text).toContain('Апартамент')
})

test('one free type and one restricted type: both are mentioned', () => {
  const text = formatOffersBg(
    [
      { id: '1', name: 'DBL', pricePerNight: 80, currency: 'BGN', availableRooms: 2 },
      { id: '2', name: 'APP', pricePerNight: 200, currency: 'BGN', availableRooms: 0, restriction: 'min_stay:3' },
    ],
    '2026-09-12', '2026-09-14',
  )
  expect(text).toContain('DBL')
  expect(text).toContain('APP')
  expect(text).toContain('минималният престой')
})

test('room type codes are spoken as words and keep the code for the booking tool', () => {
  const text = formatOffersBg(
    [
      { id: '1', name: 'DBL', pricePerNight: 55, currency: 'BGN', availableRooms: 30 },
      { id: '2', name: 'FAM', pricePerNight: 75, currency: 'BGN', availableRooms: 0, restriction: 'min_stay:3' },
      { id: '3', name: 'Студио', pricePerNight: 88, currency: 'EUR', availableRooms: 2 },
    ],
    '2026-09-20', '2026-09-22',
  )
  expect(text).toContain('Двойна стая (код DBL)')
  expect(text).toContain('Семейна стая (код FAM)')
  expect(text).toContain('Студио: 2 свободна/и')
})
