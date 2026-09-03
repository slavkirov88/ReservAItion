import { buildBookingBody } from './booking-body'
import { splitName } from '@/lib/inventory/clock'

// A Bulgarian hotel's guests have Bulgarian names. If this seam is wrong, every
// single booking the agent makes carries a broken name into the hotel's PMS.
test('a Cyrillic name survives the split and the JSON encoding', () => {
  const [first, last] = splitName('Иван Петров Георгиев')
  expect(first).toBe('Иван')
  expect(last).toBe('Петров Георгиев')

  const body = buildBookingBody({
    arrival: '2026-09-15', departure: '2026-09-17', roomTypeId: 42414, rateId: 799189,
    adults: 2, children: 0, firstName: first, lastName: last,
    phone: '+359888000111', email: null, mainBookingGuestId: null, referenceNumber: 'call-1',
  })

  const json = JSON.stringify(body)
  expect(json).toContain('"guest_first_name":"Иван"')
  expect(JSON.parse(json).booking.guest_last_name).toBe('Петров Георгиев')
  // What goes on the wire is UTF-8: two bytes per Cyrillic letter.
  expect(Buffer.byteLength('Иван', 'utf8')).toBe(8)
})
