import { addMinutes, format, parse } from 'date-fns'

export interface ScheduleRule {
  start_time: string
  end_time: string
  slot_duration_min: number
  break_start?: string | null
  break_end?: string | null
}

export interface BookedSlot {
  starts_at: string
  ends_at: string
}

export function generateSlots(
  date: string,
  rule: ScheduleRule,
  booked: BookedSlot[]
): string[] {
  const slots: string[] = []
  const parseTime = (t: string) => parse(`${date} ${t}`, 'yyyy-MM-dd HH:mm', new Date())

  let current = parseTime(rule.start_time)
  const end = parseTime(rule.end_time)
  const breakStart = rule.break_start ? parseTime(rule.break_start) : null
  const breakEnd = rule.break_end ? parseTime(rule.break_end) : null

  while (current < end) {
    const slotEnd = addMinutes(current, rule.slot_duration_min)
    if (slotEnd > end) break

    // Check break overlap
    const inBreak = breakStart && breakEnd &&
      current >= breakStart && current < breakEnd

    // Check booking overlap
    const isBooked = booked.some(b => {
      const bStart = new Date(b.starts_at)
      const bEnd = new Date(b.ends_at)
      return current < bEnd && slotEnd > bStart
    })

    if (!inBreak && !isBooked) {
      slots.push(format(current, 'HH:mm'))
    }

    current = addMinutes(current, rule.slot_duration_min)
  }

  return slots
}
