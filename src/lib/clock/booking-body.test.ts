import { buildBookingBody } from './booking-body'

const base = {
  arrival: '2026-09-12',
  departure: '2026-09-14',
  roomTypeId: 42414,
  rateId: 799198,
  adults: 2,
  children: 1,
  firstName: 'Иван',
  lastName: 'Иванов',
  phone: '+359888123456',
  email: null,
  mainBookingGuestId: null,
  referenceNumber: 'call-abc',
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const build = (over: Record<string, unknown> = {}) => buildBookingBody({ ...base, ...over } as any) as any

test('main_booking_guest sits outside the booking object', () => {
  const body = build({ mainBookingGuestId: '123' })
  expect(body.main_booking_guest).toBe('123')
  expect(body.booking.main_booking_guest).toBeUndefined()
})

test('an unknown guest sends no main_booking_guest at all', () => {
  const body = build()
  expect(body.main_booking_guest).toBeUndefined()
})

test('adults and children are separate integers', () => {
  const body = build()
  expect(body.booking.adults).toBe(2)
  expect(body.booking.children).toBe(1)
})

// The receptionist decides which room. We only say which type.
test('no room is assigned', () => {
  const body = build()
  expect(body.booking.arrival_room_id).toBeUndefined()
  expect(body.booking.arrival_room_type_id).toBe(42414)
})

test('the booking is marked as coming from the AI receptionist', () => {
  const body = build()
  expect(body.booking.note).toContain('ReservAItion')
  expect(body.booking.marketing_source).toBe('Phone')
})

test('a name and a phone are enough, no email needed', () => {
  const body = build()
  expect(body.booking.guest_first_name).toBe('Иван')
  expect(body.booking.guest_last_name).toBe('Иванов')
  expect(body.booking.guest_phone_number).toBe('+359888123456')
  expect(body.booking.guest_e_mail).toBeUndefined()
})

test('an email is sent when the guest gave one', () => {
  expect(build({ email: 'ivan@example.com' }).booking.guest_e_mail).toBe('ivan@example.com')
})

// Clock checks availability on create and this API user cannot override it.
// Refusing here beats a 400 in the middle of a phone call.
test('a rate id is required', () => {
  expect(() => build({ rateId: null })).toThrow(/rate/i)
})

test('a room type is required too', () => {
  expect(() => build({ roomTypeId: null })).toThrow(/room type/i)
})

test('the stay is marked expected and carries the call as its reference', () => {
  const body = build()
  expect(body.booking.status).toBe('expected')
  expect(body.booking.arrival).toBe('2026-09-12')
  expect(body.booking.departure).toBe('2026-09-14')
  expect(body.booking.reference_number).toBe('call-abc')
})

// A guest who only gave one name still has to be bookable.
test('a single name does not produce an empty last name field', () => {
  const body = build({ lastName: null })
  expect(body.booking.guest_first_name).toBe('Иван')
  expect(body.booking.guest_last_name).toBeUndefined()
})

test('zero children is sent as zero, not dropped', () => {
  expect(build({ children: 0 }).booking.children).toBe(0)
})
