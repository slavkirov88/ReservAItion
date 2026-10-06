// Validates the /razgovor contact payload.

export type ContactPayload = {
  stage: 'contact'
  leadId: string
  name: string
  phone: string
  email: string
  property: string
}

export type ParseResult =
  | { ok: true; data: ContactPayload }
  | { ok: false; error: 'validation' }

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const fail: ParseResult = { ok: false, error: 'validation' }

const str = (v: unknown, max = 500) => (typeof v === 'string' ? v.trim().slice(0, max) : '')

export function parseLeadPayload(input: unknown): ParseResult {
  if (!input || typeof input !== 'object') return fail
  const p = input as Record<string, unknown>
  const leadId = str(p.leadId, 64)
  if (!leadId || p.stage !== 'contact') return fail

  const name = str(p.name, 100)
  const phone = str(p.phone, 40)
  const email = str(p.email, 200)
  const property = str(p.property, 300)
  if (!name || phone.replace(/\D/g, '').length < 6 || !EMAIL.test(email) || !property) return fail
  return { ok: true, data: { stage: 'contact', leadId, name, phone, email, property } }
}
