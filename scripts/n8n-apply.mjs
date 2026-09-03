// Apply adults/children/ages + robust phone to the LIVE reservation workflow.
//   node scripts/n8n-apply.mjs          -> DRY RUN (prints new Code + columns, no write)
//   node scripts/n8n-apply.mjs --apply  -> PUT the workflow
import fs from 'node:fs'

for (const f of ['.env.local', '.env']) if (fs.existsSync(f)) {
  for (const l of fs.readFileSync(f, 'utf8').split('\n')) {
    const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
}
const N = process.env.N8N_API_KEY, NB = (process.env.N8N_BASE_URL || '').replace(/\/$/, '')
const WF = 'wSAjInlswYT3AscX'
const APPLY = process.argv.includes('--apply')
const H = { 'X-N8N-API-KEY': N, 'Content-Type': 'application/json', accept: 'application/json' }
const api = (p, opt = {}) => fetch(`${NB}/api/v1${p}`, { headers: H, ...opt }).then(async r => {
  if (!r.ok) throw new Error(`${opt.method || 'GET'} ${p} -> ${r.status} ${await r.text()}`)
  return r.json()
})

const w = await api(`/workflows/${WF}`)

// --- new Code node logic: total always; adults/children/ages only if children; phone = caller ID first ---
const newCode = `const msg = $input.first().json.body.message;
const so = msg.artifact?.structuredOutputs || {};

const data = {};
for (const id in so) { data[so[id].name] = so[id].result; }

const adults = Number(data.adults) || 0;
const children = Number(data.children) || 0;
const hasChildren = children > 0;
const total = Number(data.guest_count) || (adults + children) || '';

return [{
  json: {
    guest_name: data.guest_name || '',
    check_in_date: data.check_in_date || '',
    check_out_date: data.check_out_date || '',
    guest_count: total,
    adults: hasChildren ? adults : '',
    children: hasChildren ? children : '',
    children_ages: hasChildren ? (data.children_ages || '') : '',
    accommodation_type: data.accommodation_type || '',
    callback_number: msg.customer?.number || data.callback_number || '',
    timestamp: msg.timestamp,
    transcript: msg.transcript || msg.artifact?.transcript || '',
    recordingUrl: msg.recordingUrl || msg.artifact?.recordingUrl || '',
    summary: msg.analysis?.summary || ''
  }
}];
`

const codeNode = w.nodes.find(n => n.type === 'n8n-nodes-base.code')
const sheetNode = w.nodes.find(n => n.type === 'n8n-nodes-base.googleSheets')
if (!codeNode || !sheetNode) throw new Error('Code or Sheet node not found — aborting.')
if (!codeNode.parameters.jsCode.includes('structuredOutputs')) throw new Error('Code node not as expected — aborting.')

codeNode.parameters.jsCode = newCode

// Add three columns after "Брой гости". Keep everything else intact.
const cols = sheetNode.parameters.columns.value
cols['Възрастни'] = '={{ $json.adults }}'
cols['Деца'] = '={{ $json.children }}'
cols['Възраст на децата'] = '={{ $json.children_ages }}'

const schema = sheetNode.parameters.columns.schema
for (const id of ['Възрастни', 'Деца', 'Възраст на децата']) {
  if (!schema.find(s => s.id === id)) {
    schema.push({ id, displayName: id, required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true })
  }
}

console.log('=== NEW Code node jsCode ===\n' + newCode)
console.log('=== Sheet column mapping (relevant) ===')
console.log('  Брой гости       :', cols['Брой гости'])
console.log('  Възрастни        :', cols['Възрастни'])
console.log('  Деца             :', cols['Деца'])
console.log('  Възраст на децата:', cols['Възраст на децата'])

if (!APPLY) { console.log('\n[DRY RUN] No write. Re-run with --apply.'); process.exit(0) }

// PUT only the allowed fields. settings: whitelist keys the API schema accepts.
const allowed = ['saveExecutionProgress','saveManualExecutions','saveDataErrorExecution','saveDataSuccessExecution','executionTimeout','errorWorkflow','timezone','executionOrder']
const settings = {}
for (const k of allowed) if (w.settings?.[k] !== undefined) settings[k] = w.settings[k]
const body = { name: w.name, nodes: w.nodes, connections: w.connections, settings }
const updated = await api(`/workflows/${WF}`, { method: 'PUT', body: JSON.stringify(body) })
console.log('\n[APPLIED] PUT ok. active =', updated.active)
if (!updated.active) {
  await api(`/workflows/${WF}/activate`, { method: 'POST' })
  console.log('Re-activated workflow.')
}
