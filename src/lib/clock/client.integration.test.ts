// ---------------------------------------------------------------------------
// Opt-in integration check against the real Clock PMS+ sandbox.
//
// Skipped unless CLOCK_ENV_FILE points at a file holding the credentials, so a
// normal `npm test` never touches the network or someone else's system:
//
//   CLOCK_ENV_FILE=/path/to/.env.local npx jest client.integration
//
// The path is passed rather than the key itself, so no secret ends up in a
// shell history or a terminal transcript.
//
// Read-only. Nothing here creates, changes or deletes anything in the PMS.
// ---------------------------------------------------------------------------

import fs from 'node:fs'
import { clockGet, resetRateLimiter, type ClockCredentials } from './client'

const envFile = process.env.CLOCK_ENV_FILE

function loadCreds(): ClockCredentials | null {
  if (!envFile || !fs.existsSync(envFile)) return null
  const env = Object.fromEntries(
    fs.readFileSync(envFile, 'utf8')
      .split(/\r?\n/)
      .filter((l) => /^[A-Za-z_]/.test(l))
      .map((l) => {
        const i = l.indexOf('=')
        return [l.slice(0, i).trim(), l.slice(i + 1).trim()]
      }),
  )
  if (!env.CLOCK_PMS_API_URL || !env.CLOCK_VOICE_API_USER || !env.CLOCK_VOICE_API_KEY) return null
  return {
    baseUrl: env.CLOCK_PMS_API_URL,
    apiUser: env.CLOCK_VOICE_API_USER,
    apiKey: env.CLOCK_VOICE_API_KEY,
  }
}

const creds = loadCreds()
const itLive = creds ? test : test.skip

beforeEach(() => resetRateLimiter())
jest.setTimeout(30_000)

itLive('the digest handshake works against the live sandbox', async () => {
  const roomTypes = await clockGet<Array<{ id: number; name: string }>>(creds!, 'room_types')
  expect(Array.isArray(roomTypes)).toBe(true)
  expect(roomTypes.length).toBeGreaterThan(0)
  expect(roomTypes[0]).toHaveProperty('id')
})

// rates_availability is the call the cache is built on, and the one whose
// contract the documentation gets wrong: room_types is required even though
// it is written up as optional, and children_ages must be an array.
itLive('rates_availability answers with repeated array parameters', async () => {
  const rates = await clockGet<Array<{ id: number }>>(creds!, 'rates')
  const roomTypes = await clockGet<Array<{ id: number }>>(creds!, 'room_types')

  const from = new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10)
  const to = new Date(Date.now() + 9 * 864e5).toISOString().slice(0, 10)

  const result = await clockGet<Array<{ id: number; rates: Record<string, unknown> }>>(
    creds!,
    'rates_availability',
    {
      query: { from, to, adults: 2, children: 1 },
      repeated: {
        'rates[]': rates.slice(0, 3).map((r) => r.id),
        'room_types[]': roomTypes.map((t) => t.id),
        'children_ages[]': [5],
      },
    },
  )

  expect(Array.isArray(result)).toBe(true)
  const day = Object.values(Object.values(result[0].rates)[0] as Record<string, never>)[0] as {
    free: boolean
    price: { cents: number; currency: string }
  }
  expect(typeof day.free).toBe('boolean')
  // Their sandbox prices in BGN. Nothing in this codebase may assume euro.
  expect(day.price.currency).toBeTruthy()
})

itLive('guests search needs at least three characters, and says so', async () => {
  await expect(
    clockGet(creds!, 'guests/search', { query: { free_text_search: 'ab' }, trailingSlash: false, retries: 0 }),
  ).rejects.toThrow(/too short|500/i)
})
