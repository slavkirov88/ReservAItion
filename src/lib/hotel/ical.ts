import type { IcalBlockInsert } from '@/types/database'

// Parse iCal text → array of IcalBlockInsert records
export function parseIcalFeed(
  icalText: string,
  roomId: string,
  tenantId: string,
  source: string
): IcalBlockInsert[] {
  try {
    const eventRegex = /BEGIN:VEVENT([\s\S]*?)END:VEVENT/g
    const blocks: IcalBlockInsert[] = []
    let match

    while ((match = eventRegex.exec(icalText)) !== null) {
      const body = match[1]
      const dtstart = body.match(/DTSTART[^:]*:(\d{8})/)
      const dtend = body.match(/DTEND[^:]*:(\d{8})/)
      const summary = body.match(/SUMMARY:(.+)/)

      if (!dtstart || !dtend) continue

      const toDate = (s: string) =>
        `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`

      blocks.push({
        room_id: roomId,
        tenant_id: tenantId,
        source,
        start_date: toDate(dtstart[1]),
        end_date: toDate(dtend[1]),
        summary: summary?.[1]?.trim() ?? null,
      })
    }

    return blocks
  } catch {
    return []
  }
}

// Generate iCal text from reservations (for OTA export)
export function generateIcalFeed(
  reservations: Array<{
    id: string
    guest_name: string
    check_in: string
    check_out: string
  }>,
  hotelName: string,
  roomId: string
): string {
  const toIcalDate = (d: string) => d.replace(/-/g, '')

  const events = reservations.map(r => `BEGIN:VEVENT
DTSTART;VALUE=DATE:${toIcalDate(r.check_in)}
DTEND;VALUE=DATE:${toIcalDate(r.check_out)}
SUMMARY:Reservation - ${r.guest_name}
UID:${r.id}@hotelai
END:VEVENT`).join('\n')

  return `BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//HotelAI//EN\nX-WR-CALNAME:${hotelName} - Room ${roomId}\n${events}\nEND:VCALENDAR`
}
