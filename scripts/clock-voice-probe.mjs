// ---------------------------------------------------------------------------
// Read-only probe of the Clock PMS+ sandbox as the voice API user.
//
// Confirms the credentials work and captures real response shapes to use as
// test fixtures, so the mapping code is written against what Clock actually
// returns rather than against the documentation's prose.
//
// Their rules, followed here rather than discovered the hard way:
//   - 5 calls per second per API user. This script is sequential and paced.
//   - A 403 means their WAF banned this IP for about two hours. Stop, do not
//     retry, and do not try neighbouring paths hoping one exists.
//   - Only documented endpoints are called. Probing for undocumented ones is
//     what the WAF counts as an attack.
//
// Usage:
//   node scripts/clock-voice-probe.mjs <path-to-env-file> [--out <dir>]
// ---------------------------------------------------------------------------

import fs from 'node:fs'
import path from 'node:path'
import { createHash, randomBytes } from 'node:crypto'

const envPath = process.argv[2]
if (!envPath) {
  console.error('usage: node scripts/clock-voice-probe.mjs <path-to-env-file> [--out <dir>]')
  process.exit(1)
}
const outIdx = process.argv.indexOf('--out')
const outDir = outIdx > -1 ? process.argv[outIdx + 1] : null

const env = Object.fromEntries(
  fs.readFileSync(envPath, 'utf8')
    .split(/\r?\n/)
    .filter((l) => /^[A-Za-z_]/.test(l))
    .map((l) => {
      const i = l.indexOf('=')
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()]
    }),
)

const PMS = env.CLOCK_PMS_API_URL
const USER = env.CLOCK_VOICE_API_USER
const KEY = env.CLOCK_VOICE_API_KEY

if (!PMS || !USER || !KEY) {
  console.error('missing CLOCK_PMS_API_URL / CLOCK_VOICE_API_USER / CLOCK_VOICE_API_KEY')
  process.exit(1)
}

const md5 = (v) => createHash('md5').update(v).digest('hex')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

function parseChallenge(header) {
  const fields = {}
  const body = header.replace(/^\s*Digest\s+/i, '')
  for (const m of body.matchAll(/([a-zA-Z0-9_-]+)\s*=\s*(?:"([^"]*)"|([^,\s]+))/g)) {
    fields[m[1].toLowerCase()] = m[2] ?? m[3] ?? ''
  }
  return fields
}

// The digest covers the path AND the query string. Dropping the query here
// produces a 401 that looks exactly like a wrong key.
function digestHeader(challenge, method, uri) {
  const cnonce = randomBytes(8).toString('hex')
  const nc = '00000001'
  const realm = challenge.realm ?? ''
  const nonce = challenge.nonce ?? ''
  const qop = challenge.qop?.split(/[,\s]+/).find((q) => q === 'auth')
  const ha1 = md5(`${USER}:${realm}:${KEY}`)
  const ha2 = md5(`${method}:${uri}`)
  const response = qop
    ? md5(`${ha1}:${nonce}:${nc}:${cnonce}:${qop}:${ha2}`)
    : md5(`${ha1}:${nonce}:${ha2}`)

  let h = `Digest username="${USER}", realm="${realm}", nonce="${nonce}", uri="${uri}", response="${response}"`
  if (qop) h += `, qop=${qop}, nc=${nc}, cnonce="${cnonce}"`
  if (challenge.opaque) h += `, opaque="${challenge.opaque}"`
  return h
}

async function get(pathAndQuery) {
  const url = PMS.replace(/\/$/, '') + pathAndQuery
  const uri = new URL(url).pathname + new URL(url).search

  const first = await fetch(url, { headers: { Accept: 'application/json' } })
  if (first.status === 403) throw new Error('403 - WAF ban. Stop calling for two hours.')
  if (first.status !== 401) return { status: first.status, body: await first.text() }

  const challenge = parseChallenge(first.headers.get('www-authenticate') ?? '')
  const second = await fetch(url, {
    headers: { Accept: 'application/json', Authorization: digestHeader(challenge, 'GET', uri) },
  })
  if (second.status === 403) throw new Error('403 - WAF ban. Stop calling for two hours.')
  return { status: second.status, body: await second.text() }
}

const iso = (d) => d.toISOString().slice(0, 10)
const today = new Date()
const plus = (n) => { const d = new Date(today); d.setDate(d.getDate() + n); return iso(d) }

function save(name, text) {
  if (!outDir) return
  fs.mkdirSync(outDir, { recursive: true })
  fs.writeFileSync(path.join(outDir, name), text)
  console.log(`   saved -> ${path.join(outDir, name)}`)
}

function preview(text, n = 400) {
  return text.length > n ? text.slice(0, n) + ' …' : text
}

const run = async () => {
  console.log(`Clock voice probe: ${USER} against ${PMS}\n`)

  // 1. room_types - cheap, proves auth and permissions in one call.
  console.log('1. GET /room_types/')
  const rt = await get('/room_types/')
  console.log(`   ${rt.status}`)
  if (rt.status !== 200) { console.log(`   ${preview(rt.body)}`); return }
  const roomTypes = JSON.parse(rt.body)
  const rtList = Array.isArray(roomTypes) ? roomTypes : roomTypes.room_types ?? []
  console.log(`   ${rtList.length} room types: ${rtList.map((t) => `${t.id} ${t.name}`).join(' | ')}`)
  save('room_types.json', rt.body)

  await sleep(300)

  // 2. rates - needed as a required parameter for both of the calls below.
  console.log('\n2. GET /rates/')
  const r = await get('/rates/')
  console.log(`   ${r.status}`)
  if (r.status !== 200) { console.log(`   ${preview(r.body)}`); return }
  const rates = JSON.parse(r.body)
  const rateList = Array.isArray(rates) ? rates : rates.rates ?? []
  console.log(`   ${rateList.length} rates: ${rateList.map((x) => `${x.id} ${x.name ?? ''}`).join(' | ')}`)
  save('rates.json', r.body)

  const rateIds = rateList.map((x) => x.id).filter(Boolean)
  if (rateIds.length === 0) { console.log('\nno rates, cannot continue'); return }

  await sleep(300)

  // 3. rates_availability - their heaviest call, the one we cache.
  const from = plus(7)
  const to = plus(14)
  const q = `/rates_availability/?from=${from}&to=${to}&rates=${rateIds.join(',')}&adults=2&children=1&children_ages=5`
  console.log(`\n3. GET /rates_availability/ (${from} .. ${to}, 2 adults + 1 child aged 5)`)
  const ra = await get(q)
  console.log(`   ${ra.status}`)
  console.log(`   ${preview(ra.body, 700)}`)
  save('rates_availability.json', ra.body)

  await sleep(300)

  // 4. products - the per-request check made once, just before booking.
  const pq = `/products?product_search[arrival]=${from}&product_search[departure]=${to}` +
    rateIds.map((id) => `&rates[]=${id}`).join('') +
    `&product_search[adult_count]=2&product_search[children_count]=1&product_search[children_ages][]=5`
  console.log(`\n4. GET /products`)
  const pr = await get(pq)
  console.log(`   ${pr.status}`)
  console.log(`   ${preview(pr.body, 700)}`)
  save('products.json', pr.body)

  await sleep(300)

  // 5. guests search - the step that stops every repeat guest becoming a
  //    duplicate in the hotel's own database.
  console.log('\n5. GET /guests/search?free_text_search=a')
  const gs = await get('/guests/search?free_text_search=a')
  console.log(`   ${gs.status}`)
  console.log(`   ${preview(gs.body, 400)}`)
  save('guests_search.json', gs.body)

  console.log('\ndone - every call above was read-only')
}

run().catch((e) => { console.error('\nFAILED:', e.message); process.exit(1) })
