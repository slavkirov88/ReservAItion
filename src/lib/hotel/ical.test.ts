import { parseIcalFeed, generateIcalFeed } from './ical'

const SAMPLE_ICAL = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
DTSTART;VALUE=DATE:20260410
DTEND;VALUE=DATE:20260413
SUMMARY:Reserved
END:VEVENT
END:VCALENDAR`

describe('parseIcalFeed', () => {
  it('extracts date blocks from iCal string', () => {
    const blocks = parseIcalFeed(SAMPLE_ICAL, 'room-1', 'tenant-1', 'booking.com')
    expect(blocks).toHaveLength(1)
    expect(blocks[0].start_date).toBe('2026-04-10')
    expect(blocks[0].end_date).toBe('2026-04-13')
    expect(blocks[0].room_id).toBe('room-1')
  })

  it('returns empty array for malformed iCal', () => {
    const blocks = parseIcalFeed('NOT VALID ICAL', 'room-1', 'tenant-1', 'airbnb')
    expect(blocks).toEqual([])
  })
})

describe('generateIcalFeed', () => {
  it('generates valid iCal string from reservations', () => {
    const reservations = [{
      id: 'res-1',
      guest_name: 'Ivan',
      check_in: '2026-04-10',
      check_out: '2026-04-13',
    }]
    const feed = generateIcalFeed(reservations, 'Hotel Test', 'room-1')
    expect(feed).toContain('BEGIN:VCALENDAR')
    expect(feed).toContain('DTSTART;VALUE=DATE:20260410')
    expect(feed).toContain('DTEND;VALUE=DATE:20260413')
  })
})
