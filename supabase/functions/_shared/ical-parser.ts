// Deno-compatible shared module for Edge Functions
// NOTE: This duplicates src/lib/hotel/ical.ts parseIcalFeed — kept in sync manually

export interface IcalBlockInsert {
  room_id: string
  tenant_id: string
  source: string
  start_date: string
  end_date: string
  summary: string | null
  synced_at: string
}

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
        synced_at: new Date().toISOString(),
      })
    }

    return blocks
  } catch {
    return []
  }
}
