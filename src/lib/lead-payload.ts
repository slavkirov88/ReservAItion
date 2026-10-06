// Validates the two-stage /razgovor funnel payloads.

export const PROPERTY_TYPES = ['Хотел', 'Хостел', 'Къщи за гости', 'Апартаменти под наем', 'Друго']
export const CHANNEL_OPTIONS = ['Booking.com', 'Airbnb', 'Собствен сайт', 'Телефон', 'Viber', 'Друго']
export const MISSED_CALLS = ['Почти никое', '1-5 седмично', 'Над 5 седмично', 'Не знам']

export type ContactPayload = {
  stage: 'contact'
  leadId: string
  name: string
  phone: string
  email: string
  property: string
}

export type DetailsPayload = {
  stage: 'details'
  leadId: string
  name: string
  phone: string
  propertyType: string
  channels: string[]
  missedCalls: string
  pms: string
}

export type ParseResult =
  | { ok: true; data: ContactPayload | DetailsPayload }
  | { ok: false; error: 'validation' }

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const fail: ParseResult = { ok: false, error: 'validation' }

const str = (v: unknown, max = 500) => (typeof v === 'string' ? v.trim().slice(0, max) : '')

export function parseLeadPayload(input: unknown): ParseResult {
  if (!input || typeof input !== 'object') return fail
  const p = input as Record<string, unknown>
  const leadId = str(p.leadId, 64)
  if (!leadId) return fail

  if (p.stage === 'contact') {
    const name = str(p.name, 100)
    const phone = str(p.phone, 40)
    const email = str(p.email, 200)
    const property = str(p.property, 300)
    if (!name || phone.replace(/\D/g, '').length < 6 || !EMAIL.test(email) || !property) return fail
    return { ok: true, data: { stage: 'contact', leadId, name, phone, email, property } }
  }

  if (p.stage === 'details') {
    const type = str(p.propertyType, 40)
    const missed = str(p.missedCalls, 40)
    const channels = Array.isArray(p.channels)
      ? p.channels.map((c) => str(c, 30)).filter((c) => CHANNEL_OPTIONS.includes(c))
      : []
    return {
      ok: true,
      data: {
        stage: 'details',
        leadId,
        name: str(p.name, 100),
        phone: str(p.phone, 40),
        propertyType: PROPERTY_TYPES.includes(type) ? type : '',
        channels,
        missedCalls: MISSED_CALLS.includes(missed) ? missed : '',
        pms: str(p.pms, 300),
      },
    }
  }

  return fail
}
