// scripts/audit-prompts.mts
// Prompt-table audit. Reports duplicate rows, orchestrators with more than one
// active prompt (which makes loadActivePrompt throw and takes the orchestrator
// down), and which version is live for each orchestrator.
//
// Written after exactly that failure: DiagnosisV2Orchestrator and
// DiscoveryNetworkOrchestrator each had two active v1 rows and nothing surfaced
// it, because discover-offers swallows a network-enrichment failure as
// non-fatal. Migration 0044 makes the duplicates impossible; this keeps the
// invariant checkable.
//
//   npx tsx scripts/audit-prompts.mts
//
// Exits non-zero when something is broken, so it can gate a deploy.
import { readFileSync } from 'node:fs'

import { createClient } from '@supabase/supabase-js'

const env: Record<string, string> = { ...(process.env as Record<string, string>) }
for (const line of readFileSync('.env.local', 'utf-8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.+?)\s*$/)
  if (m) env[m[1]!] = m[2]!
}
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
})

const { data, error } = await db
  .from('prompts')
  .select('id, orchestrator_name, prompt_type, version, vertical_id, is_active, created_at')
  .order('orchestrator_name')
  .order('version')
if (error) {
  console.log('query failed:', error.message)
  process.exit(1)
}

type Row = NonNullable<typeof data>[number]
const byKey = new Map<string, Row[]>()
for (const r of data ?? []) {
  const k = `${r.orchestrator_name}|${r.prompt_type}|${r.version}|${r.vertical_id ?? 'NULL'}`
  byKey.set(k, [...(byKey.get(k) ?? []), r])
}

console.log('=== duplicate (orchestrator, type, version, vertical) rows ===')
let dupes = 0
for (const [k, rows] of byKey) {
  if (rows.length > 1) {
    dupes++
    console.log(`  ${k}  x${rows.length}   active: ${rows.filter((r) => r.is_active).length}`)
    for (const r of rows) console.log(`      ${r.id}  active=${r.is_active}  ${r.created_at}`)
  }
}
if (!dupes) console.log('  (none)')

console.log('\n=== orchestrators with more than one ACTIVE global prompt (loadActivePrompt throws) ===')
const activeByOrch = new Map<string, Row[]>()
for (const r of data ?? []) {
  if (!r.is_active || r.prompt_type !== 'main' || r.vertical_id !== null) continue
  activeByOrch.set(r.orchestrator_name, [...(activeByOrch.get(r.orchestrator_name) ?? []), r])
}
let broken = 0
for (const [name, rows] of activeByOrch) {
  if (rows.length > 1) {
    broken++
    console.log(`  BROKEN ${name}: ${rows.length} active -> ${rows.map((r) => r.version).join(', ')}`)
  }
}
if (!broken) console.log('  (none — loadActivePrompt is safe)')

console.log('\n=== active version per orchestrator ===')
const names = [...new Set((data ?? []).map((r) => r.orchestrator_name))].sort()
let noneActive = 0
for (const n of names) {
  const rows = (data ?? []).filter(
    (r) => r.orchestrator_name === n && r.prompt_type === 'main' && r.vertical_id === null
  )
  const active = rows.filter((r) => r.is_active).map((r) => r.version)
  if (active.length === 0) noneActive++
  const all = rows.map((r) => r.version).join(',')
  console.log(`  ${n.padEnd(34)} active=[${active.join(',') || 'NONE'}]  have=[${all}]`)
}

const problems = dupes + broken + noneActive
console.log(
  problems === 0
    ? '\nOK: no duplicates, exactly one active prompt per orchestrator.'
    : `\n${problems} problem(s): ${dupes} duplicate group(s), ${broken} with multiple active, ${noneActive} with none active.`
)
// exitCode rather than exit(): let Node drain its handles, or Windows trips a
// libuv assertion on the way out.
process.exitCode = problems === 0 ? 0 : 1
