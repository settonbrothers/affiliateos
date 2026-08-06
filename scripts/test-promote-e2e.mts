// scripts/test-promote-e2e.mts
// Integration test for the Discovery -> Underwriting bridge (migration 0043).
//
// Drives the real promote path (parseStoredDeepAnalysis -> deepAnalysisToFacts
// -> writePromotedEvidence / writeNetworkData) against a REAL stored
// deep_analysis, on a throwaway offer that is deleted at the end. Follows the
// same create-and-clean-up shape as the other scripts/test-*-e2e scripts.
//
// It does NOT touch the candidate row, so nothing real is marked promoted.
//
//   npx tsx scripts/test-promote-e2e.mts
//
// Needs NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in .env.local.
import { readFileSync } from 'node:fs'

import { createClient } from '@supabase/supabase-js'

import {
  PROMOTE_VERIFY_MIN_CONFIDENCE,
  buildOperatorNotes,
  deepAnalysisToFacts,
  parseStoredDeepAnalysis,
} from '../src/lib/discovery/promote'
import {
  writeNetworkData,
  writePromotedEvidence,
} from '../src/lib/discovery/promoteWrites'

const env: Record<string, string> = { ...(process.env as Record<string, string>) }
for (const line of readFileSync('.env.local', 'utf-8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.+?)\s*$/)
  if (m) env[m[1]!] = m[2]!
}

const db = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL!,
  env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
)

let failures = 0
function check(label: string, pass: boolean, detail = ''): void {
  if (!pass) failures++
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${label}${detail ? ` — ${detail}` : ''}`)
}

// Pick the richest real candidate so the assertions mean something.
const { data: cands } = await db
  .from('discovery_candidates')
  .select('id, name, url, vertical_id, deep_analysis, network_analysis')
  .not('deep_analysis', 'is', null)
  .order('deep_score', { ascending: false })
  .limit(20)

let picked: { name: string; url: string | null; vertical_id: string | null } | null = null
let promo: ReturnType<typeof deepAnalysisToFacts> | null = null
let notes = ''
let networkRaw: unknown = null
for (const c of cands ?? []) {
  const parsed = parseStoredDeepAnalysis(c.deep_analysis)
  if (!parsed) continue
  const p = deepAnalysisToFacts(parsed, c.url as string | null)
  const verified = p.facts.filter(
    (f) => f.confidence_score >= PROMOTE_VERIFY_MIN_CONFIDENCE
  ).length
  if (verified >= 5 && c.vertical_id) {
    picked = { name: c.name as string, url: c.url as string | null, vertical_id: c.vertical_id as string }
    promo = p
    notes = buildOperatorNotes(parsed)
    networkRaw = c.network_analysis
    break
  }
}

if (!picked || !promo) {
  console.log('No analysed candidate with >=5 verified facts. Run a scan first.')
  process.exit(1)
}
console.log(`Using real analysis from: ${picked.name}\n`)

const { data: profile } = await db.from('profiles').select('id').limit(1).single()
const slug = `zz-promote-e2e-${Date.now()}`

const { data: offer, error: offerErr } = await db
  .from('offers')
  .insert({
    name: `[E2E] ${picked.name}`,
    slug,
    vertical_id: picked.vertical_id,
    website_url: picked.url,
    created_by_user_id: profile!.id,
    status: 'needs_source_ingestion',
    visibility: 'admin_only',
    operator_notes: notes,
    discovery_candidate_id: (cands ?? []).find((c) => c.name === picked!.name)?.id ?? null,
  })
  .select('id, status, operator_notes, discovery_candidate_id')
  .single()

check('offer insert accepts discovery_candidate_id', !offerErr, offerErr?.message)
if (offerErr || !offer) process.exit(1)
const offerId = offer.id as string

try {
  check(
    'offer starts on the status ladder, not past it',
    offer.status === 'needs_source_ingestion',
    `got ${offer.status}`
  )
  check(
    'operator_notes carries the qualitative read',
    (offer.operator_notes as string)?.length > 200,
    `${(offer.operator_notes as string)?.length ?? 0} chars`
  )
  check('back-link to the candidate is set', !!offer.discovery_candidate_id)

  const wrote = await writePromotedEvidence(db, offerId, promo.sources, promo.facts)
  check('evidence writes succeed', !wrote, (wrote as { error?: string })?.error)

  await writeNetworkData(db, offerId, networkRaw)

  // Read back the way the offer page does (getVerifiedFacts).
  const { data: readBack, error: readErr } = await db
    .from('extracted_facts')
    .select('fact_type, fact_value, source_quote, confidence_score, source_documents(url)')
    .eq('offer_id', offerId)
    .eq('status', 'verified')
  check('verified facts read back', !readErr, readErr?.message)
  check(
    'offer clears the 5-verified-fact bar that capped it at watch',
    (readBack?.length ?? 0) >= 5,
    `${readBack?.length ?? 0} verified facts`
  )
  check(
    'every fact carries its source quote',
    (readBack ?? []).every((f) => !!f.source_quote),
    ''
  )
  check(
    'facts link back to a source document',
    (readBack ?? []).some((f) => !!f.source_documents),
    ''
  )

  const { count: docCount } = await db
    .from('source_documents')
    .select('*', { count: 'exact', head: true })
    .eq('offer_id', offerId)
  check('source documents created', (docCount ?? 0) > 0, `${docCount} docs`)

  console.log('\n--- what the offer Overview will show ---')
  for (const f of readBack ?? []) {
    const host = (f.source_documents as { url: string | null } | null)?.url ?? 'research'
    console.log(`  ${f.fact_type.padEnd(26)} ${f.fact_value.slice(0, 58).padEnd(58)} [${host}]`)
  }
} finally {
  // offers cascades to source_documents + extracted_facts + offer_network_data
  const { error: delErr } = await db.from('offers').delete().eq('id', offerId)
  console.log(`\ncleanup: ${delErr ? `FAILED ${delErr.message} (offer ${offerId})` : 'throwaway offer deleted'}`)
}

console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) FAILED.`)
process.exit(failures === 0 ? 0 : 1)
