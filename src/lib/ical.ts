// ---------------------------------------------------------------------------
// Minimal iCalendar (RFC 5545) utilities — no external dependencies
// ---------------------------------------------------------------------------

export interface ICalEvent {
  uid: string
  summary: string
  dtstart: string // YYYY-MM-DD
  dtend: string   // YYYY-MM-DD (exclusive — checkout day)
  description?: string
  status?: string // CONFIRMED | CANCELLED | TENTATIVE
}

// ---------------------------------------------------------------------------
// GENERATE .ics
// ---------------------------------------------------------------------------

function toICalDate(dateStr: string): string {
  // YYYY-MM-DD → 20260401
  return dateStr.replace(/-/g, '')
}

function escapeICalText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n')
}

export function generateICalFeed(
  events: ICalEvent[],
  calendarName: string,
  prodId: string = '-//ReservAItion//Hotel Calendar//BG',
): string {
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:${prodId}`,
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeICalText(calendarName)}`,
    'X-WR-TIMEZONE:Europe/Sofia',
  ]

  for (const ev of events) {
    const dtstart = toICalDate(ev.dtstart)
    // dtend: if same as dtstart (single day), add 1 day
    const dtend = ev.dtend && ev.dtend !== ev.dtstart
      ? toICalDate(ev.dtend)
      : addOneDay(dtstart)

    lines.push('BEGIN:VEVENT')
    lines.push(`UID:${ev.uid}`)
    lines.push(`DTSTART;VALUE=DATE:${dtstart}`)
    lines.push(`DTEND;VALUE=DATE:${dtend}`)
    lines.push(`SUMMARY:${escapeICalText(ev.summary)}`)
    if (ev.description) lines.push(`DESCRIPTION:${escapeICalText(ev.description)}`)
    lines.push(`STATUS:${ev.status || 'CONFIRMED'}`)
    lines.push(`DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').split('.')[0]}Z`)
    lines.push('END:VEVENT')
  }

  lines.push('END:VCALENDAR')
  return lines.join('\r\n')
}

function addOneDay(icalDate: string): string {
  // icalDate = YYYYMMDD
  const d = new Date(
    parseInt(icalDate.slice(0, 4)),
    parseInt(icalDate.slice(4, 6)) - 1,
    parseInt(icalDate.slice(6, 8)) + 1,
  )
  return d.getFullYear().toString() +
    String(d.getMonth() + 1).padStart(2, '0') +
    String(d.getDate()).padStart(2, '0')
}

// ---------------------------------------------------------------------------
// PARSE .ics
// ---------------------------------------------------------------------------

export interface ParsedICalEvent {
  uid: string
  summary: string
  dtstart: string // YYYY-MM-DD
  dtend: string   // YYYY-MM-DD
  status: string
}

export function parseICalFeed(icsText: string): ParsedICalEvent[] {
  const events: ParsedICalEvent[] = []
  const lines = icsText.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')

  // Unfold long lines (lines starting with space/tab are continuations)
  const unfolded: string[] = []
  for (const line of lines) {
    if ((line.startsWith(' ') || line.startsWith('\t')) && unfolded.length > 0) {
      unfolded[unfolded.length - 1] += line.slice(1)
    } else {
      unfolded.push(line)
    }
  }

  let inEvent = false
  let current: Partial<ParsedICalEvent> = {}

  for (const line of unfolded) {
    if (line === 'BEGIN:VEVENT') {
      inEvent = true
      current = {}
      continue
    }
    if (line === 'END:VEVENT') {
      inEvent = false
      if (current.uid && current.dtstart) {
        events.push({
          uid: current.uid,
          summary: current.summary || 'Blocked',
          dtstart: current.dtstart,
          dtend: current.dtend || current.dtstart,
          status: current.status || 'CONFIRMED',
        })
      }
      continue
    }

    if (!inEvent) continue

    const colonIdx = line.indexOf(':')
    if (colonIdx === -1) continue

    const key = line.slice(0, colonIdx).split(';')[0].toUpperCase()
    const value = line.slice(colonIdx + 1).trim()

    switch (key) {
      case 'UID': current.uid = value; break
      case 'SUMMARY': current.summary = value.replace(/\\n/g, ' ').replace(/\\,/g, ','); break
      case 'STATUS': current.status = value; break
      case 'DTSTART': current.dtstart = parseICalDateValue(line); break
      case 'DTEND': current.dtend = parseICalDateValue(line); break
    }
  }

  return events
}

function parseICalDateValue(line: string): string {
  // Handles: DTSTART;VALUE=DATE:20260401  or  DTSTART:20260401T000000Z
  const colonIdx = line.indexOf(':')
  const raw = line.slice(colonIdx + 1).trim()
  const datePart = raw.slice(0, 8) // YYYYMMDD
  if (datePart.length === 8 && /^\d{8}/.test(datePart)) {
    return `${datePart.slice(0, 4)}-${datePart.slice(4, 6)}-${datePart.slice(6, 8)}`
  }
  return raw
}
