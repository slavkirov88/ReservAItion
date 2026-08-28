// Read-only inspection of the n8n reservation workflow + latest execution.
// Requires N8N_API_KEY and N8N_BASE_URL in .env.local (loaded from cwd).

import fs from 'node:fs'

for (const file of ['.env.local', '.env']) {
  if (fs.existsSync(file)) {
    for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
    }
  }
}

const KEY = process.env.N8N_API_KEY
const BASE = (process.env.N8N_BASE_URL || '').replace(/\/$/, '')
if (!KEY || !BASE) { console.error('Missing N8N_API_KEY or N8N_BASE_URL'); process.exit(1) }

const api = async (path) => {
  const r = await fetch(`${BASE}/api/v1${path}`, { headers: { 'X-N8N-API-KEY': KEY, accept: 'application/json' } })
  if (!r.ok) throw new Error(`GET ${path} -> ${r.status} ${await r.text()}`)
  return r.json()
}

const wf = await api('/workflows?limit=100')
const list = wf.data || wf
console.log('=== WORKFLOWS ===')
for (const w of list) console.log(`${w.active ? '🟢' : '⚪'} ${w.id}  ${w.name}`)

// Active "(clean)" reservation workflow.
const WF_ID = process.argv[2] || 'wSAjInlswYT3AscX'
const w = await api(`/workflows/${WF_ID}`)
console.log(`\n=== WORKFLOW ${w.id} — ${w.name} (active=${w.active}) ===`)
console.log('\nNODES:')
for (const n of w.nodes) console.log(`  • ${n.name}  [${n.type}]`)

// Dump parameters of nodes that likely do field mapping / DB writes.
console.log('\n=== MAPPING / WRITE NODE PARAMETERS ===')
for (const n of w.nodes) {
  if (/set|edit fields|supabase|google sheets|http request|code|function|postgres/i.test(n.type)) {
    console.log(`\n--- ${n.name} [${n.type}] ---`)
    console.log(JSON.stringify(n.parameters, null, 2))
  }
}

// Latest execution payload (ground truth of what Vapi sends).
const ex = await api(`/executions?workflowId=${WF_ID}&includeData=true&limit=1`)
const run = (ex.data || ex)[0]
if (run) {
  console.log(`\n=== LATEST EXECUTION ${run.id} (${run.startedAt}) status=${run.status} ===`)
  const runData = run.data?.resultData?.runData || {}
  console.log('Nodes in runData:', Object.keys(runData).join(', '))
  const wh = runData['Webhook']?.[0]?.data?.main?.[0]?.[0]?.json
  const msg = wh?.body?.message
  console.log('\nbody.message keys:', msg ? Object.keys(msg).join(', ') : '(no body.message)')
  console.log('\nmsg.customer:', JSON.stringify(msg?.customer, null, 2))
  console.log('msg.call?.customer:', JSON.stringify(msg?.call?.customer, null, 2))
  console.log('msg.phoneNumber:', JSON.stringify(msg?.phoneNumber, null, 2))
  console.log('\nstructuredOutputs:')
  const so = msg?.artifact?.structuredOutputs || msg?.analysis?.structuredOutputs || {}
  for (const id in so) console.log(`  ${so[id].name} = ${JSON.stringify(so[id].result)}`)
} else {
  console.log('\nNo executions found.')
}
