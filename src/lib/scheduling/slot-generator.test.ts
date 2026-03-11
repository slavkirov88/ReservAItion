import { generateSlots } from './slot-generator'

test('generates slots for a standard day', () => {
  const rule = { start_time: '09:00', end_time: '12:00', slot_duration_min: 30 }
  const booked: never[] = []
  const slots = generateSlots('2026-03-10', rule, booked)
  expect(slots).toHaveLength(6)
  expect(slots[0]).toBe('09:00')
  expect(slots[5]).toBe('11:30')
})

test('excludes booked slots', () => {
  const rule = { start_time: '09:00', end_time: '10:30', slot_duration_min: 30 }
  const booked = [{ starts_at: '2026-03-10T09:00:00', ends_at: '2026-03-10T09:30:00' }]
  const slots = generateSlots('2026-03-10', rule, booked)
  expect(slots).toHaveLength(2)
  expect(slots).not.toContain('09:00')
})

test('excludes break time', () => {
  const rule = {
    start_time: '09:00', end_time: '15:00',
    slot_duration_min: 60, break_start: '13:00', break_end: '14:00'
  }
  const slots = generateSlots('2026-03-10', rule, [])
  expect(slots).not.toContain('13:00')
  expect(slots).toContain('14:00')
})

test('returns empty array for inactive day', () => {
  const rule = { start_time: '09:00', end_time: '09:00', slot_duration_min: 30 }
  const slots = generateSlots('2026-03-10', rule, [])
  expect(slots).toHaveLength(0)
})
