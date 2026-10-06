import { rateLimited, sanitizeHistory, validateChatLead } from './sanitize'

describe('sanitizeHistory', () => {
  it('drops junk and keeps plain messages', () => {
    const out = sanitizeHistory([
      { role: 'user', content: 'здравей' },
      { role: 'system', content: 'hack' },
      { role: 'assistant', content: 'Здравейте' },
      { role: 'user', content: 5 },
      null,
    ])
    expect(out.map((m) => m.role)).toEqual(['user', 'assistant'])
  })

  it('starts with a user message and caps the length', () => {
    const many = Array.from({ length: 60 }, (_, i) => ({ role: i % 2 ? 'user' : 'assistant', content: 'x' }))
    const out = sanitizeHistory(many)
    expect(out.length).toBeLessThanOrEqual(20)
    expect(out[0].role).toBe('user')
  })

  it('returns [] for non-arrays', () => {
    expect(sanitizeHistory('nope')).toEqual([])
  })
})

describe('validateChatLead', () => {
  const good = { name: 'Иван', phone: '0888123456', email: 'i@example.com', property: 'Хотел Мура, 12 стаи' }
  it('accepts complete data', () => {
    expect(validateChatLead(good).ok).toBe(true)
  })
  it('rejects a bad email or missing field', () => {
    expect(validateChatLead({ ...good, email: 'x' }).ok).toBe(false)
    expect(validateChatLead({ ...good, property: '' }).ok).toBe(false)
  })
})

describe('rateLimited', () => {
  it('blocks after the limit and frees after the window', () => {
    const ip = 'test-ip-1'
    const t0 = 1_000_000
    for (let i = 0; i < 3; i++) expect(rateLimited(ip, 3, 1000, t0)).toBe(false)
    expect(rateLimited(ip, 3, 1000, t0)).toBe(true)
    expect(rateLimited(ip, 3, 1000, t0 + 2000)).toBe(false)
  })
})
