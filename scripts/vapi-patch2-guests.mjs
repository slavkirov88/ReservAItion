// Re-patch the live assistant prompt: ask ONLY total guests; ask child ages
// only if the guest spontaneously mentions children.
//   node scripts/vapi-patch2-guests.mjs --apply
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

for (const f of ['.env.local', '.env']) if (fs.existsSync(f)) {
  for (const l of fs.readFileSync(f, 'utf8').split('\n')) {
    const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
}
const V = process.env.VAPI_API_KEY
const ID = '6565d0f2-4e3e-4ccc-aabb-52d802a14a30'
const APPLY = process.argv.includes('--apply')
const H = { Authorization: `Bearer ${V}`, 'Content-Type': 'application/json' }
const __dirname = path.dirname(fileURLToPath(import.meta.url))

const a = await fetch(`https://api.vapi.ai/assistant/${ID}`, { headers: H }).then(r => r.json())
const sys = a.model.messages.find(m => m.role === 'system')
let p = sys.content
fs.writeFileSync(path.join(__dirname, `live-prompt-backup-${new Date().toISOString().replace(/[:.]/g,'-')}.txt`), p)

function rep(find, repl) {
  const re = new RegExp(find.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '[ \\t]*')
  if (!re.test(p)) throw new Error('Anchor not found, aborting:\n' + find)
  p = p.replace(re, repl)
}

rep('2. Брой възрастни и деца (поотделно)', '2. Брой гости')

rep(`„За колко възрастни ще бъде резервацията?"
След отговора: „А пътувате ли с деца? Ако да — колко деца и на каква възраст е всяко?"
ВАЖНО: възрастни и деца са ДВЕ РАЗДЕЛНИ числа — никога не ги сливай в едно.
Пример: „двама възрастни и едно дете" → възрастни: 2, деца: 1. НЕ казвай „трима души".
Възрастта на детето е важна за легло и цена — питай я веднъж, ако има поне едно дете.`,
`„За колко човека ще бъде резервацията?"
Питай само за общия брой хора. НЕ питай отделно за възрастни и деца.
Само ако гостът САМ спомене деца (напр. „двама възрастни и две деца"), чак тогава попитай веднъж: „На каква възраст са децата?"
Ако не спомене деца — не питай нищо за деца, приеми числото като общ брой гости.
Когато има деца: запомни общия брой, и поотделно колко са възрастни, колко деца и възрастта им.`)

rep('4. Стъпките са в строг ред: дати → възрастни → деца (и възраст) → тип → име → телефон. Не прескачай.',
    '4. Стъпките са в строг ред: дати → брой гости (и възраст на децата, само ако спомене деца) → тип → име → телефон. Не прескачай.')

rep('Гости: {брой_възрастни} възрастни{ако има деца — добави: и {брой_деца} деца на възраст {възрасти}}.',
    'Брой гости: {общ_брой}{ако има деца — добави: , от които {брой_деца} деца на възраст {възрасти}}.')

rep('• Никога не пропускай броя гости — кажи възрастни и деца поотделно (и възрастта на децата, ако има).',
    '• Никога не пропускай броя гости. Ако има деца — кажи и възрастта им.')

rep('- Знам ли броя възрастни и броя деца поотделно (и възрастта на децата)? Да/не.',
    '- Знам ли общия брой гости (и възрастта на децата, ако има деца)? Да/не.')

rep('Винаги казвай конкретните числа поотделно, напр.: "двама възрастни и едно дете на пет години".',
    'Винаги казвай конкретното число, напр.: "четирима, от които две деца на пет и шест години".')

console.log('Patched. New guest section preview:')
console.log(p.split('\n').slice(p.split('\n').findIndex(l => l.includes('2. Брой гости')), 10).join('\n'))

if (!APPLY) { console.log('\n[DRY RUN]'); process.exit(0) }

const msgs = a.model.messages.map(m => m.role === 'system' ? { ...m, content: p } : m)
const newModel = { provider: a.model.provider, model: a.model.model, messages: msgs,
  ...(a.model.toolIds ? { toolIds: a.model.toolIds } : {}) }
const r = await fetch(`https://api.vapi.ai/assistant/${ID}`, { method: 'PATCH', headers: H, body: JSON.stringify({ model: newModel }) })
if (!r.ok) throw new Error(`PATCH failed ${r.status} ${await r.text()}`)
console.log('\n[APPLIED] prompt updated. model still:', (await r.json()).model?.model)
