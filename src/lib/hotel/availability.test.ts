import { isDateRangeAvailable, buildBlockedRanges } from './availability'

describe('buildBlockedRanges', () => {
  it('combines reservations and ical blocks into date ranges', () => {
    const reservations = [
      { check_in: '2026-04-10', check_out: '2026-04-13' },
    ]
    const icalBlocks = [
      { start_date: '2026-04-20', end_date: '2026-04-22' },
    ]
    const ranges = buildBlockedRanges(reservations, icalBlocks)
    expect(ranges).toHaveLength(2)
  })
})

describe('isDateRangeAvailable', () => {
  it('returns true when no overlap', () => {
    const blocked = [{ start: '2026-04-10', end: '2026-04-13' }]
    expect(isDateRangeAvailable('2026-04-14', '2026-04-16', blocked)).toBe(true)
  })

  it('returns false when overlap exists', () => {
    const blocked = [{ start: '2026-04-10', end: '2026-04-13' }]
    expect(isDateRangeAvailable('2026-04-12', '2026-04-15', blocked)).toBe(false)
  })

  it('allows check-in on same day as previous check-out (half-open interval)', () => {
    const blocked = [{ start: '2026-04-10', end: '2026-04-13' }]
    // check_out is exclusive: guest leaving on 13th, new guest arriving on 13th = OK
    expect(isDateRangeAvailable('2026-04-13', '2026-04-15', blocked)).toBe(true)
  })
})
