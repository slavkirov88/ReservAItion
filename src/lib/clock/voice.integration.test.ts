// ---------------------------------------------------------------------------
// Opt-in integration check of the four voice calls against the real sandbox.
//
// Skipped unless CLOCK_ENV_FILE points at a file holding the credentials:
//
//   CLOCK_ENV_FILE=/path/to/.env.local npx jest voice.integration
//
// Read-only. Nothing here creates, changes or deletes anything in the PMS.
// The write path was proven once, by hand, in scripts/clock-booking-probe.mjs;
// it does not belong in a test suite that anyone may run twice.
// ---------------------------------------------------------------------------

import fs from 'node:fs'
import { resetRateLimiter, type ClockCredentials } from './client'
import { getProducts, getRates, getRatesAvailability, getRoomTypes, searchGuests } from './voice'
import { toCacheRows } from './availability-map'

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

const iso = (offsetDays: number) =>
  new Date(Date.now() + offsetDays * 864e5).toISOString().slice(0, 10)

itLive('the cache is built from what Clock actually answers', async () => {
  const roomTypes = (await getRoomTypes(creds!)).filter((t) => t.is_virtual !== true)
  const rates = await getRates(creds!)
  expect(roomTypes.length).toBeGreaterThan(0)
  expect(rates.length).toBeGreaterThan(0)

  const response = await getRatesAvailability(creds!, {
    from: iso(7),
    to: iso(10),
    rateIds: rates.slice(0, 3).map((r) => r.id),
    roomTypeIds: roomTypes.map((t) => t.id),
    adults: 2,
    children: 1,
    childrenAges: [5],
  })

  const names = Object.fromEntries(roomTypes.map((t) => [t.id, t.name]))
  const rows = toCacheRows('tenant-under-test', response, names)

  expect(rows.length).toBeGreaterThan(0)
  expect(rows[0].room_type_name).toBeTruthy()
  expect(rows[0].currency).toBeTruthy()
  expect(typeof rows[0].free).toBe('boolean')
  // Their sandbox prices in lev. Nothing in this codebase may assume euro.
  expect(rows.every((r) => r.price_cents === null || r.price_cents > 0)).toBe(true)
})

itLive('products answers with a rate we could book on', async () => {
  const rates = await getRates(creds!)
  const products = await getProducts(creds!, {
    arrival: iso(7),
    departure: iso(9),
    rateIds: rates.slice(0, 6).map((r) => r.id),
    adults: 2,
    children: 0,
  })

  expect(Array.isArray(products)).toBe(true)
  const anyRate = products.flatMap((p) => Object.values(p.rates ?? {})).flat()
  expect(anyRate.length).toBeGreaterThan(0)
  expect(anyRate[0]).toHaveProperty('available')
})

itLive('a search too short comes back empty instead of throwing', async () => {
  await expect(searchGuests(creds!, 'ab')).resolves.toEqual([])
})
