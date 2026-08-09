// scripts/audit-discovery-quality.mts
// Discovery quality audit, no labelling required.
//
// The eval harness measures one thing today: whether Underwriting's verdict
// matches a golden label. Discovery has no eval at all, and building one the
// way 07_EVAL_HARNESS.md describes needs a hand-labelled set, which R10 names
// as the bottleneck. This measures something orthogonal and immediately
// available: whether each stored deep analysis obeys the rules its own prompt
// states — recommended only when all four filters pass and the score clears 55,
// every resolved filter backed by evidence, every unresolved one carried into
// must_verify_before_budget, every confident signal evidenced.
//
// It cannot tell you a judgement is right. It can tell you the model stopped
// following its own rubric, which is the failure mode that quietly erodes
// trust in every verdict downstream.
//
//   npx tsx scripts/audit-discovery-quality.mts [--limit 200]
//
// Exits non-zero when conformance drops below CLEAN_THRESHOLD.
import { readFileSync } from 'node:fs'

import { createClient } from '@supabase/supabase-js'

import { parseStoredDeepAnalysis } from '../src/lib/discovery/promote'
import { checkDeepAnalysis, summarize } from '../src/lib/discovery/quality'

const CLEAN_THRESHOLD = 0.9

const limitArg = process.argv.indexOf('--limit')
const LIMIT = limitArg > -1 ? Number(process.argv[limitArg + 1]) : 200

const env: Record<string, string> = { ...(process.env as Record<string, string>) }
for (const line of readFileSync('.env.local', 'utf-8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.+?)\s*$/)
  if (m) env[m[1]!] = m[2]!
}

const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
})

const { data, error } = await db
  .from('discovery_candidates')
  .select('id, name, deep_analysis')
  .not('deep_analysis', 'is', null)
  .order('created_at', { ascending: false })
  .limit(LIMIT)

if (error) {
  console.error('query failed:', error.message)
  process.exitCode = 1
} else if (!data?.length) {
  console.log('No analysed candidates yet — run a discovery scan first.')
} else {
  const parsed = data.map((c) => parseStoredDeepAnalysis(c.deep_analysis))
  const report = summarize(parsed)

  console.log(`=== discovery rubric conformance (${report.total} candidates) ===`)
  const cleanPct = report.total === 0 ? 1 : report.clean / report.total
  console.log(`clean: ${report.clean}/${report.total}  (${(cleanPct * 100).toFixed(1)}%)`)
  console.log(
    `hard-filter verdicts citing a source URL: ${(report.citedFilterRate * 100).toFixed(1)}%`
  )

  if (Object.keys(report.byRule).length > 0) {
    console.log('\nviolations by rule:')
    for (const [rule, n] of Object.entries(report.byRule).sort((a, b) => b[1] - a[1])) {
      console.log(`  ${String(n).padStart(4)}  ${rule}`)
    }

    console.log('\nworst offenders:')
    const offenders = data
      .map((c, i) => ({ name: c.name as string, v: checkDeepAnalysis(parsed[i]!) }))
      .filter((o) => o.v.length > 0)
      .sort((a, b) => b.v.length - a.v.length)
      .slice(0, 8)
    for (const o of offenders) {
      console.log(`  [${o.name}]`)
      for (const x of o.v) console.log(`      ${x.rule}: ${x.detail}`)
    }
  }

  console.log(
    cleanPct >= CLEAN_THRESHOLD
      ? `\nOK: conformance at or above ${(CLEAN_THRESHOLD * 100).toFixed(0)}%.`
      : `\nBELOW BAR: ${(cleanPct * 100).toFixed(1)}% clean, want ${(CLEAN_THRESHOLD * 100).toFixed(0)}%.`
  )
  // exitCode rather than exit(): let Node drain, or Windows trips a libuv assert.
  process.exitCode = cleanPct >= CLEAN_THRESHOLD ? 0 : 1
}
