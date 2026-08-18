import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { createClient } from '@supabase/supabase-js'

const args = process.argv.slice(2)
const valueAfter = (flag: string) => {
  const index = args.indexOf(flag)
  return index >= 0 ? args[index + 1] : undefined
}
const sync = args.includes('--sync')
const packsPath = resolve(
  valueAfter('--packs') ??
    '../creation-engine/tests/story-evidence/source-packs.json'
)
const protocolPath = resolve(
  valueAfter('--protocol') ??
    '../creation-engine/tests/story-evidence/protocol.json'
)
const sealsPath = resolve(
  valueAfter('--seals') ??
    '../creation-engine/tests/story-evidence/sealed-checksums.json'
)
const resultsPath = valueAfter('--results')
  ? resolve(valueAfter('--results')!)
  : null

const packsFile = JSON.parse(readFileSync(packsPath, 'utf8')) as {
  packs: Array<
    Record<string, unknown> & { id: string; domain: string; split: string }
  >
}
const protocol = JSON.parse(readFileSync(protocolPath, 'utf8')) as {
  protocol: string
  cases: number
  domains: Record<string, number>
  splits: Record<string, number>
  engines: string[]
  repetitions_per_engine: number
  total_pipeline_runs: number
  acceptance: Record<string, number>
}
const seals = JSON.parse(readFileSync(sealsPath, 'utf8')) as {
  packs: Record<string, string>
}
const normalize = (value: unknown): unknown =>
  Array.isArray(value)
    ? value.map(normalize)
    : value && typeof value === 'object'
      ? Object.fromEntries(
          Object.keys(value as Record<string, unknown>)
            .sort()
            .map((key) => [
              key,
              normalize((value as Record<string, unknown>)[key]),
            ])
        )
      : value
const sha = (value: unknown) =>
  createHash('sha256')
    .update(JSON.stringify(normalize(value)))
    .digest('hex')
const failures: string[] = []

if (packsFile.packs.length !== protocol.cases)
  failures.push(`case count ${packsFile.packs.length} != ${protocol.cases}`)
for (const pack of packsFile.packs)
  if (sha(pack) !== seals.packs[pack.id])
    failures.push(`${pack.id}: seal mismatch`)
for (const [domain, expected] of Object.entries(protocol.domains))
  if (
    packsFile.packs.filter((pack) => pack.domain === domain).length !== expected
  )
    failures.push(`${domain}: wrong case count`)
for (const [split, expected] of Object.entries(protocol.splits))
  if (
    packsFile.packs.filter((pack) => pack.split === split).length !== expected
  )
    failures.push(`${split}: wrong case count`)
if (
  protocol.total_pipeline_runs !==
  protocol.cases * protocol.engines.length * protocol.repetitions_per_engine
)
  failures.push('preregistered total is inconsistent')

type LiveResults = {
  protocol: string
  model_id: string
  prompt_manifest_sha256: string
  baseline_version: string
  candidate_version: string
  holdout_revealed: boolean
  total_cost_usd?: number
  runs: Array<{
    case_id: string
    engine: string
    repetition: number
    decision: string
    truth_violations: string[]
  }>
  owner_scores: Array<{
    case_id: string
    preference: 'baseline' | 'candidate' | 'tie'
    baseline_score: number
    candidate_score: number
    owner_publishable_candidate: boolean
    owner_truth_reject_candidate: boolean
    judge_publishable_candidate: boolean
  }>
}

let metrics: Record<string, unknown> | null = null
let passed = false
let live: LiveResults | null = null
if (resultsPath && existsSync(resultsPath)) {
  live = JSON.parse(readFileSync(resultsPath, 'utf8')) as LiveResults
  if (live.protocol !== protocol.protocol)
    failures.push('live protocol mismatch')
  if (live.runs.length !== protocol.total_pipeline_runs)
    failures.push(
      `live run count ${live.runs.length} != ${protocol.total_pipeline_runs}`
    )
  if (live.owner_scores.length !== protocol.cases)
    failures.push(
      `owner pair count ${live.owner_scores.length} != ${protocol.cases}`
    )
  const candidateRuns = live.runs.filter(
    (run) => run.engine === 'evidence_story_candidate'
  )
  const truthViolations = candidateRuns.reduce(
    (count, run) => count + run.truth_violations.length,
    0
  )
  const stableCases = packsFile.packs.filter(
    (pack) =>
      new Set(
        candidateRuns
          .filter((run) => run.case_id === pack.id)
          .map((run) => run.decision)
      ).size === 1
  ).length
  const wins = live.owner_scores.filter(
    (score) => score.preference === 'candidate'
  ).length
  const losses = live.owner_scores.filter(
    (score) => score.preference === 'baseline'
  ).length
  const averageDelta =
    live.owner_scores.reduce(
      (sum, score) => sum + score.candidate_score - score.baseline_score,
      0
    ) / Math.max(1, live.owner_scores.length)
  const agreement =
    live.owner_scores.filter(
      (score) =>
        score.owner_publishable_candidate === score.judge_publishable_candidate
    ).length / Math.max(1, live.owner_scores.length)
  const falsePasses = live.owner_scores.filter(
    (score) =>
      score.owner_truth_reject_candidate && score.judge_publishable_candidate
  ).length
  metrics = {
    wins,
    losses,
    average_score_delta: averageDelta,
    candidate_truth_violations: truthViolations,
    stable_mode_cases: stableCases,
    judge_owner_agreement: agreement,
    judge_false_pass_on_truth_rejects: falsePasses,
  }
  passed =
    wins >= protocol.acceptance.candidate_min_wins &&
    losses <= protocol.acceptance.candidate_max_losses &&
    averageDelta >= protocol.acceptance.min_average_score_delta &&
    truthViolations === protocol.acceptance.candidate_truth_violations &&
    stableCases >= protocol.acceptance.stable_mode_cases_min &&
    agreement >= protocol.acceptance.judge_owner_agreement_min &&
    falsePasses === protocol.acceptance.judge_false_pass_on_truth_rejects
} else {
  console.log(
    'PENDING live generation and owner scoring; protocol validation only'
  )
}

if (failures.length) {
  for (const failure of failures) console.error(`FAIL ${failure}`)
  process.exit(1)
}

console.log(
  `PASS copy evidence protocol: ${protocol.cases} sealed cases, ${protocol.total_pipeline_runs} preregistered runs`
)
if (metrics)
  console.log(
    `${passed ? 'PASS' : 'FAIL'} live acceptance ${JSON.stringify(metrics)}`
  )

if (sync) {
  if (!live || !metrics)
    throw new Error('--sync requires --results with a completed live run')
  const env = { ...process.env }
  try {
    for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.+?)\s*$/)
      if (match) env[match[1]] = match[2]
    }
  } catch {}
  if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY)
    throw new Error('Supabase env is required for --sync')
  const db = createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  )
  const { error: caseError } = await db.from('copy_eval_cases').upsert(
    packsFile.packs.map((pack) => ({
      external_id: pack.id,
      domain: pack.domain,
      split: pack.split,
      source_pack: pack,
      sealed_sha256: seals.packs[pack.id],
      ...(live!.holdout_revealed && pack.split === 'holdout'
        ? { revealed_at: new Date().toISOString() }
        : {}),
    })),
    { onConflict: 'external_id' }
  )
  if (caseError) throw caseError
  const { error: runError } = await db
    .from('copy_eval_runs')
    .insert({
      protocol_version: protocol.protocol,
      engine_version: live.candidate_version,
      baseline_version: live.baseline_version,
      prompt_manifest_sha256: live.prompt_manifest_sha256,
      model_id: live.model_id,
      repetitions_per_engine: protocol.repetitions_per_engine,
      status: passed ? 'passed' : 'failed',
      metrics,
      details: live,
      total_cost_usd: live.total_cost_usd ?? null,
      completed_at: new Date().toISOString(),
    })
  if (runError) throw runError
  console.log('Synced copy eval cases and completed run')
}
