import { parseLeadPayload } from './lead-payload'

const contact = {
  stage: 'contact', leadId: 'abc', name: 'Иван', phone: '0888123456',
  email: 'i@example.com', property: 'Хотел Мура, 12 стаи',
}

describe('parseLeadPayload', () => {
  it('accepts a valid contact payload', () => {
    expect(parseLeadPayload(contact).ok).toBe(true)
  })

  it.each([
    ['empty name', { name: ' ' }],
    ['short phone', { phone: '123' }],
    ['bad email', { email: 'nope' }],
    ['no property', { property: '' }],
    ['no leadId', { leadId: '' }],
    ['unknown stage', { stage: 'details' }],
  ])('rejects %s', (_label, patch) => {
    expect(parseLeadPayload({ ...contact, ...patch }).ok).toBe(false)
  })

  it('rejects non-objects', () => {
    expect(parseLeadPayload(null).ok).toBe(false)
  })
})
