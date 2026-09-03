import {
  parseDigestChallenge,
  buildDigestHeader,
  resolve,
  resetRateLimiter,
  ClockBannedError,
  ClockForbiddenError,
  clockGet,
} from './client'

beforeEach(() => resetRateLimiter())

test('parses a digest challenge with quoted and bare fields', () => {
  const fields = parseDigestChallenge('Digest realm="clock", qop=auth, nonce="abc", stale=false')
  expect(fields.realm).toBe('clock')
  expect(fields.qop).toBe('auth')
  expect(fields.nonce).toBe('abc')
  expect(fields.stale).toBe('false')
})

test('digest header carries the user and the uri', () => {
  const header = buildDigestHeader({
    challenge: { realm: 'clock', nonce: 'abc', qop: 'auth' },
    method: 'GET',
    uri: '/pms_api/1/2/rooms/',
    username: 'u',
    password: 'k',
    cnonce: 'fixed-for-the-test',
  })
  expect(header).toContain('username="u"')
  expect(header).toContain('uri="/pms_api/1/2/rooms/"')
  expect(header).toContain('response=')
  expect(header).toContain('qop=auth')
})

// The query string is part of HA2. If it were dropped, Clock would answer 401
// and the error would look exactly like a wrong key.
test('the digest changes when the query string changes', () => {
  const of = (uri: string) =>
    buildDigestHeader({
      challenge: { realm: 'clock', nonce: 'abc', qop: 'auth' },
      method: 'GET',
      uri,
      username: 'u',
      password: 'k',
      cnonce: 'fixed',
    })
  expect(of('/x/?from=2026-09-06')).not.toBe(of('/x/?from=2026-09-07'))
})

test('repeated parameters are appended, not overwritten', () => {
  const { uri } = resolve('https://host/pms_api/1/2', 'rates_availability', {
    query: { from: '2026-09-06' },
    repeated: { 'rates[]': [1, 2], 'room_types[]': [42414] },
  })
  expect(uri).toContain('rates%5B%5D=1')
  expect(uri).toContain('rates%5B%5D=2')
  expect(uri).toContain('room_types%5B%5D=42414')
})

test('a trailing slash is added for collections and skipped when asked', () => {
  expect(resolve('https://host/a', 'rooms').uri).toBe('/a/rooms/')
  expect(resolve('https://host/a', 'guests/search', { trailingSlash: false }).uri).toBe('/a/guests/search')
})

// ---------------------------------------------------------------------------
// The two meanings of 403.
//
// Verified against the sandbox on 2026-08-30: a user without a right gets the
// same status as a caller the WAF has banned. Only the body separates them,
// and the difference decides whether someone waits two hours or writes to
// Clock asking for a permission.
// ---------------------------------------------------------------------------

const creds = { baseUrl: 'https://host/pms_api/1/2', apiUser: 'u', apiKey: 'k' }

// A Response body can only be read once, so every call gets a fresh one.
// Sharing one instance makes a retry look like a "body already read" bug.
function answers(status: number, body: string) {
  const mock = jest.fn(async () =>
    new Response(body, { status, headers: { 'Content-Type': 'application/json' } }),
  )
  global.fetch = mock as unknown as typeof fetch
  return mock
}

test('a 403 about a missing right is not reported as a ban', async () => {
  answers(403, JSON.stringify({ error: "The User doesn't have pms_api_rates_availability_show right" }))

  await expect(clockGet(creds, 'rates_availability', { retries: 0 })).rejects.toBeInstanceOf(ClockForbiddenError)
})

test('the missing right is named in the error', async () => {
  answers(403, JSON.stringify({ error: "The User doesn't have pms_api_rates_availability_show right" }))

  const error = await clockGet(creds, 'rates_availability', { retries: 0 }).catch((e) => e)
  expect(error.right).toBe('pms_api_rates_availability_show')
  expect(error.message).toContain('pms_api_rates_availability_show')
})

test('a bare 403 is still treated as a WAF ban', async () => {
  answers(403, 'Forbidden')

  const error = await clockGet(creds, 'rooms', { retries: 0 }).catch((e) => e)
  expect(error).toBeInstanceOf(ClockBannedError)
  expect(error.message).toContain('two hours')
})

test('a 500 is not retried', async () => {
  const fetchMock = answers(500, "boom")

  await expect(clockGet(creds, 'rooms', { retries: 2 })).rejects.toThrow(/500/)
  expect(fetchMock).toHaveBeenCalledTimes(1)
})
