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
  ])('rejects %s', (_label, patch) => {
    expect(parseLeadPayload({ ...contact, ...patch }).ok).toBe(false)
  })

  it('rejects unknown stage and non-objects', () => {
    expect(parseLeadPayload({ ...contact, stage: 'x' }).ok).toBe(false)
    expect(parseLeadPayload(null).ok).toBe(false)
  })

  it('details drops unknown options but stays ok', () => {
    const r = parseLeadPayload({
      stage: 'details', leadId: 'abc', name: 'И', phone: '1',
      propertyType: 'Хотел', channels: ['Airbnb', 'hack'], missedCalls: 'zzz', pms: 'Clock',
    })
    expect(r.ok && r.data.stage === 'details' && r.data.channels).toEqual(['Airbnb'])
    expect(r.ok && r.data.stage === 'details' && r.data.missedCalls).toBe('')
  })
})
