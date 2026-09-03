import { toOffers, makeOwnProvider } from './own'
import type { AvailableRoomType } from '@/lib/availability'

const room: AvailableRoomType = {
  id: 'uuid-1',
  name: 'Студио',
  description: null,
  capacity: 2,
  price_per_night: 88,
  total_rooms: 3,
  available_rooms: 2,
}

test('own provider maps todays availability shape to RoomOffer', () => {
  expect(toOffers([room])).toEqual([
    { id: 'uuid-1', name: 'Студио', pricePerNight: 88, currency: 'EUR', availableRooms: 2, capacity: 2 },
  ])
})

// ---------------------------------------------------------------------------
// A Supabase stand-in small enough to read, which records what was written.
// ---------------------------------------------------------------------------
function fakeSupabase(options: { insertError?: unknown } = {}) {
  const inserts: Record<string, unknown[]> = {}

  const builder = (table: string) => {
    const chain: Record<string, unknown> = {}
    const self = () => chain
    chain.select = self
    chain.eq = self
    chain.ilike = self
    chain.single = async () =>
      table === 'room_types'
        ? { data: { id: 'room-type-uuid' }, error: null }
        : { data: { business_name: 'Хотел Тест', owner_id: 'owner-1' }, error: null }
    chain.insert = async (row: unknown) => {
      ;(inserts[table] ??= []).push(row)
      return { error: options.insertError ?? null }
    }
    return chain
  }

  return {
    from: (table: string) => builder(table),
    auth: { admin: { getUserById: async () => ({ data: { user: { email: 'owner@example.com' } } }) } },
    inserted: (table: string) => inserts[table] ?? [],
  }
}

const request = {
  guestName: 'Иван Иванов',
  guestPhone: '+359888123456',
  guestEmail: null,
  checkIn: '2026-09-12',
  checkOut: '2026-09-14',
  roomTypeRef: 'Студио',
  guests: { adults: 2, children: 1, childrenAges: '5 години' },
  callId: 'call-1',
}

test('own createBooking notifies the owner and inserts the row', async () => {
  const supabase = fakeSupabase()
  const notify = jest.fn()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const provider = makeOwnProvider(supabase as any, 'tenant-1', { notify })

  const result = await provider.createBooking(request)

  expect(supabase.inserted('reservations')).toHaveLength(1)
  expect(notify).toHaveBeenCalledTimes(1)
  expect(result.ok).toBe(true)
  expect(result.source).toBe('own')
})

test('the guest breakdown reaches the row, total included', async () => {
  const supabase = fakeSupabase()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await makeOwnProvider(supabase as any, 'tenant-1', { notify: jest.fn() }).createBooking(request)

  const row = supabase.inserted('reservations')[0] as Record<string, unknown>
  expect(row.adults).toBe(2)
  expect(row.children).toBe(1)
  expect(row.children_ages).toBe('5 години')
  expect(row.guests_count).toBe(3)
  expect(row.status).toBe('inquiry')
  expect(row.channel).toBe('phone')
})

// The bug this replaces: the route logged the database error and told the
// guest "записах запитването". Nobody found out until the hotel did.
test('a failed insert is not reported as a booking', async () => {
  const supabase = fakeSupabase({ insertError: { message: 'column does not exist' } })
  const notify = jest.fn()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = await makeOwnProvider(supabase as any, 'tenant-1', { notify }).createBooking(request)

  expect(result.ok).toBe(false)
  expect(result.spokenResult).not.toContain('Записах')
  expect(notify).not.toHaveBeenCalled()
})
