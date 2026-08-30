// One-off maintenance script for the LIVE "Георги Петков" assistant.
// Usage:
//   node scripts/vapi-patch-assistant.mjs           -> DRY RUN (reads only, changes nothing)
//   node scripts/vapi-patch-assistant.mjs --apply    -> applies the patch
//
// Requires VAPI_API_KEY in the environment (.env is loaded automatically).

import fs from 'node:fs'

// --- minimal .env loader (so we never hardcode the key) ---
for (const file of ['.env.local', '.env']) {
  if (fs.existsSync(file)) {
    for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
    }
  }
}

const API_KEY = process.env.VAPI_API_KEY
if (!API_KEY) { console.error('Missing VAPI_API_KEY (.env). Aborting.'); process.exit(1) }

const ASSISTANT_ID = '6565d0f2-4e3e-4ccc-aabb-52d802a14a30'
const APPLY = process.argv.includes('--apply')
const VAPI = 'https://api.vapi.ai'
const headers = { Authorization: `Bearer ${API_KEY}`, 'Content-Type': 'application/json' }

const get = async (path) => {
  const r = await fetch(`${VAPI}${path}`, { headers })
  if (!r.ok) throw new Error(`GET ${path} -> ${r.status} ${await r.text()}`)
  return r.json()
}

const a = await get(`/assistant/${ASSISTANT_ID}`)
console.log('=== LIVE ASSISTANT ===')
console.log('name        :', a.name)
console.log('model       :', a.model?.provider, a.model?.model)
console.log('transcriber :', a.transcriber?.provider, a.transcriber?.language, a.transcriber?.model)
console.log('voice       :', a.voice?.provider, a.voice?.voiceId)
console.log('toolIds     :', a.model?.toolIds || a.model?.tools?.map(t => t.id) || '(inline tools)')
console.log('\n=== CURRENT SYSTEM PROMPT ===\n')
console.log(a.model?.messages?.find(m => m.role === 'system')?.content ?? '(none)')

for (const id of a.artifactPlan?.structuredOutputIds || []) {
  let so
  try { so = await get(`/structured-output/${id}`) }
  catch { try { so = await get(`/structured-outputs/${id}`) } catch (e) { console.log(`SO ${id} fetch failed: ${e.message}`); continue } }
  console.log(`\n=== STRUCTURED OUTPUT ${id} ===`)
  console.log('name:', so.name)
  console.log('schema:', JSON.stringify(so.schema, null, 2))
}

console.log('\n=== TOP-LEVEL KEYS ===\n', Object.keys(a).join(', '))
console.log('\n=== server ===\n', JSON.stringify(a.server, null, 2))
console.log('\n=== serverMessages ===\n', JSON.stringify(a.serverMessages, null, 2))
console.log('\n=== analysisPlan ===\n', JSON.stringify(a.analysisPlan, null, 2))
console.log('\n=== artifactPlan ===\n', JSON.stringify(a.artifactPlan, null, 2))

const toolIds = a.model?.toolIds || []
for (const id of toolIds) {
  const t = await get(`/tool/${id}`)
  console.log(`\n=== TOOL ${id} ===`)
  console.log('type:', t.type, '| name:', t.function?.name)
  console.log('description:', t.function?.description)
  console.log('parameters:', JSON.stringify(t.function?.parameters, null, 2))
  console.log('server.url:', t.server?.url)
}

if (!APPLY) {
  console.log('\n[DRY RUN] Nothing changed. Re-run with --apply once the patch is confirmed.')
  process.exit(0)
}

// ─── APPLY: patch ONLY the system prompt (adults/children + child age) ───
import path from 'node:path'
import { fileURLToPath } from 'node:url'
const __dirname = path.dirname(fileURLToPath(import.meta.url))

const sysMsg = a.model?.messages?.find(m => m.role === 'system')
if (!sysMsg) throw new Error('No system message found on assistant — aborting.')
let prompt = sysMsg.content

// Backup current prompt for rollback
const ts = new Date().toISOString().replace(/[:.]/g, '-')
const backupPath = path.join(__dirname, `live-prompt-backup-${ts}.txt`)
fs.writeFileSync(backupPath, prompt, 'utf8')
console.log('Backup saved to:', backupPath)

// Replace a single anchor line (tolerant of trailing whitespace); throw if not found.
function replaceOnce(text, find, repl) {
  const esc = find.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const re = new RegExp(esc + '[ \\t]*')
  if (!re.test(text)) throw new Error(`Anchor not found, aborting before PATCH:\n  "${find}"`)
  return text.replace(re, repl)
}

prompt = replaceOnce(prompt, '2. Брой хора', '2. Брой възрастни и деца (поотделно)')

prompt = replaceOnce(prompt,
  '„За колко човека ще бъде резервацията?"',
`„За колко възрастни ще бъде резервацията?"
След отговора: „А пътувате ли с деца? Ако да — колко деца и на каква възраст е всяко?"
ВАЖНО: възрастни и деца са ДВЕ РАЗДЕЛНИ числа — никога не ги сливай в едно.
Пример: „двама възрастни и едно дете" → възрастни: 2, деца: 1. НЕ казвай „трима души".
Възрастта на детето е важна за легло и цена — питай я веднъж, ако има поне едно дете.`)

prompt = replaceOnce(prompt,
  'Брой гости: {брой_хора}.',
  'Гости: {брой_възрастни} възрастни{ако има деца — добави: и {брой_деца} деца на възраст {възрасти}}.')

prompt = replaceOnce(prompt,
  '• Никога не пропускай Брой гости. Винаги го кажи.',
  '• Никога не пропускай броя гости — кажи възрастни и деца поотделно (и възрастта на децата, ако има).')

prompt = replaceOnce(prompt,
  '- Знам ли броя на хората? Да/не.',
  '- Знам ли броя възрастни и броя деца поотделно (и възрастта на децата)? Да/не.')

prompt = replaceOnce(prompt,
  'Винаги казвай конкретното число: "Брой гости: двама" или "Брой гости: трима".',
  'Винаги казвай конкретните числа поотделно, напр.: "двама възрастни и едно дете на пет години".')

prompt = replaceOnce(prompt,
  '4. Стъпките са в строг ред: дати → брой хора → тип → име → телефон. Не прескачай.',
  '4. Стъпките са в строг ред: дати → възрастни → деца (и възраст) → тип → име → телефон. Не прескачай.')

// Rebuild model object, changing ONLY the system message content.
const newMessages = a.model.messages.map(m => m.role === 'system' ? { ...m, content: prompt } : m)
const newModel = {
  provider: a.model.provider,
  model: a.model.model,
  messages: newMessages,
  ...(a.model.toolIds ? { toolIds: a.model.toolIds } : {}),
  ...(a.model.temperature != null ? { temperature: a.model.temperature } : {}),
  ...(a.model.maxTokens != null ? { maxTokens: a.model.maxTokens } : {}),
}

const res = await fetch(`${VAPI}/assistant/${ASSISTANT_ID}`, {
  method: 'PATCH',
  headers,
  body: JSON.stringify({ model: newModel }),
})
if (!res.ok) throw new Error(`PATCH failed -> ${res.status} ${await res.text()}`)
const updated = await res.json()
const live = updated.model?.messages?.find(m => m.role === 'system')?.content || ''
console.log('\n[APPLIED] PATCH ok.')
console.log('  model still:', updated.model?.provider, updated.model?.model)
console.log('  voice still:', updated.voice?.provider, updated.voice?.voiceId)
console.log('  transcriber still:', updated.transcriber?.provider, updated.transcriber?.language)
console.log('  new prompt contains adults/children section:', live.includes('Брой възрастни и деца'))
console.log('  rollback: paste the backup file content back into the assistant prompt, or PATCH it back.')
