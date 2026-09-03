// ---------------------------------------------------------------------------
// The one controlled write against the Clock PMS+ sandbox.
//
// It answers a single question the documentation leaves open: booking CREATE
// requires "guest_e_mail or main_booking_guest", and a guest on the phone
// rarely dictates an email. Does guest_first_name plus guest_phone_number
// satisfy it, or must the agent ask for an email before it can book?
//
// Kept separate from clock-voice-probe.mjs so that one stays honestly
// read-only. Creates AT MOST two bookings, both obviously marked as tests.
//
// Usage:
//   node scripts/clock-booking-probe.mjs <path-to-env-file> --yes
// ---------------------------------------------------------------------------

import fs from 'node:fs'
import { createHash, randomBytes } from 'node:crypto'

const envPath = process.argv[2]
if (!envPath || !process.argv.includes('--yes')) {
  console.error('This script WRITES to the Clock sandbox.')
  console.error('usage: node scripts/clock-booking-probe.mjs <path-to-env-file> --yes')
  process.exit(1)
}

const env = Object.fromEntries(
  fs.readFileSync(envPath, 'utf8').split(/\r?\n/).filter((l) => /^[A-Za-z_]/.test(l))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()] }),
)

const PMS = env.CLOCK_PMS_API_URL
const USER = env.CLOCK_VOICE_API_USER
const KEY = env.CLOCK_VOICE_API_KEY

const md5 = (v) => createHash('md5').update(v).digest('hex')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

function parseChallenge(header) {
  const f = {}
  for (const m of header.replace(/^\s*Digest\s+/i, '')
    .matchAll(/([a-zA-Z0-9_-]+)\s*=\s*(?:"([^"]*)"|([^,\s]+))/g)) f[m[1].toLowerCase()] = m[2] ?? m[3] ?? ''
  return f
}

function digestHeader(challenge, method, uri) {
  const cnonce = randomBytes(8).toString('hex')
  const nc = '00000001'
  const qop = challenge.qop?.split(/[,\s]+/).find((q) => q === 'auth')
  const ha1 = md5(`${USER}:${challenge.realm ?? ''}:${KEY}`)
  const ha2 = md5(`${method}:${uri}`)
  const response = qop
    ? md5(`${ha1}:${challenge.nonce}:${nc}:${cnonce}:${qop}:${ha2}`)
    : md5(`${ha1}:${challenge.nonce}:${ha2}`)
  let h = `Digest username="${USER}", realm="${challenge.realm}", nonce="${challenge.nonce}", uri="${uri}", response="${response}"`
  if (qop) h += `, qop=${qop}, nc=${nc}, cnonce="${cnonce}"`
  if (challenge.opaque) h += `, opaque="${challenge.opaque}"`
  return h
}

async function post(pathAndQuery, body) {
  const url = PMS.replace(/\/$/, '') + pathAndQuery
  const u = new URL(url)
  const uri = u.pathname + u.search
  const payload = JSON.stringify(body)
  const headers = { Accept: 'application/json', 'Content-Type': 'application/json' }

  const first = await fetch(url, { method: 'POST', headers, body: payload })
  if (first.status !== 401) return { status: first.status, body: await first.text() }

  const challenge = parseChallenge(first.headers.get('www-authenticate') ?? '')
  const second = await fetch(url, {
    method: 'POST',
    headers: { ...headers, Authorization: digestHeader(challenge, 'POST', uri) },
    body: payload,
  })
  return { status: second.status, body: await second.text() }
}

async function get(pathAndQuery) {
  const url = PMS.replace(/\/$/, '') + pathAndQuery
  const u = new URL(url)
  const uri = u.pathname + u.search
  const first = await fetch(url, { headers: { Accept: 'application/json' } })
  if (first.status !== 401) return { status: first.status, body: await first.text() }
  const challenge = parseChallenge(first.headers.get('www-authenticate') ?? '')
  const second = await fetch(url, {
    headers: { Accept: 'application/json', Authorization: digestHeader(challenge, 'GET', uri) },
  })
  return { status: second.status, body: await second.text() }
}

const ARRIVAL = '2026-09-06'
const DEPARTURE = '2026-09-08'
const stamp = new Date().toISOString().replace(/[:.]/g, '-')

/**
 * Clock enforces availability on create and this API user has no
 * "Rate Availability Control Override" right, which is exactly how it should
 * be: the agent cannot overbook the hotel even if our own cache is stale.
 * So the rate and room type are not guessed here, they are read back from
 * rates_availability first.
 */
async function findBookableCombination(roomTypeIds, rateIds) {
  const q = `/rates_availability/?from=${ARRIVAL}&to=${DEPARTURE}` +
    rateIds.map((r) => `&rates[]=${r}`).join('') +
    roomTypeIds.map((t) => `&room_types[]=${t}`).join('') +
    '&adults=2&children=0'
  const res = await get(q)
  if (res.status !== 200) return null

  for (const entry of JSON.parse(res.body)) {
    for (const [rateId, byDate] of Object.entries(entry.rates ?? {})) {
      const days = Object.values(byDate)
      if (days.length && days.every((d) => d.free)) {
        return { roomTypeId: entry.id, rateId: Number(rateId), price: days[0].price }
      }
    }
  }
  return null
}

const run = async () => {
  console.log('Controlled write probe against the Clock sandbox as', USER, '\n')

  console.log('0. finding a combination Clock itself reports as free')
  const rt = JSON.parse((await get('/room_types/')).body)
  const rates = JSON.parse((await get('/rates/')).body)
  const combo = await findBookableCombination(
    (Array.isArray(rt) ? rt : []).map((t) => t.id),
    (Array.isArray(rates) ? rates : []).slice(0, 8).map((r) => r.id),
  )
  if (!combo) { console.log('   nothing free in that window, stopping'); return }
  console.log(`   room type ${combo.roomTypeId}, rate ${combo.rateId}, ${combo.price.cents / 100} ${combo.price.currency}/нощ`)

  const base = {
    arrival: ARRIVAL,
    departure: DEPARTURE,
    status: 'expected',
    arrival_room_type_id: combo.roomTypeId,
    rate_id: combo.rateId,
    adults: 2,
    children: 0,
    marketing_source: 'Phone',
    note: 'ТЕСТ на интеграцията ReservAItion. Създадена автоматично, може да се изтрие.',
    guest_first_name: 'ТЕСТ',
    guest_last_name: 'ReservAItion',
    guest_phone_number: '+359888000000',
  }

  await sleep(400)

  console.log('\nA. booking CREATE with a name and a phone, NO email')
  const a = await post('/bookings/', { booking: { ...base, reference_number: `probe-a-${stamp}` } })
  console.log(`   ${a.status}`)
  console.log(`   ${a.body.replace(/\s+/g, ' ').slice(0, 500)}`)

  if (a.status >= 200 && a.status < 300) {
    console.log('\n   => The agent does NOT have to ask for an email. Prompt stays as is.')
    return
  }

  await sleep(500)

  console.log('\nB. same booking WITH an email')
  const b = await post('/bookings/', {
    booking: { ...base, reference_number: `probe-b-${stamp}`, guest_e_mail: 'test@reservaition.io' },
  })
  console.log(`   ${b.status}`)
  console.log(`   ${b.body.replace(/\s+/g, ' ').slice(0, 500)}`)

  if (b.status >= 200 && b.status < 300) {
    console.log('\n   => An email is required. The agent must ask for one before booking,')
    console.log('      or we request the guest CREATE right from Clock.')
  }
}

run().catch((e) => { console.error('FAILED:', e.message); process.exit(1) })
