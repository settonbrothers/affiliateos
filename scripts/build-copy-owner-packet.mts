import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const args = process.argv.slice(2)
const after = (flag: string) => {
  const index = args.indexOf(flag)
  return index >= 0 ? args[index + 1] : undefined
}
const resultsPath = after('--results')
if (!resultsPath)
  throw new Error(
    'usage: tsx scripts/build-copy-owner-packet.mts --results <live-generations.json> [--out-dir <dir>]'
  )
const protocolPath = resolve(
  after('--protocol') ?? '../creation-engine/tests/story-evidence/protocol.json'
)
const outDir = resolve(after('--out-dir') ?? 'eval_runs/copy-owner-packet')
const protocol = JSON.parse(readFileSync(protocolPath, 'utf8')) as {
  protocol: string
  blind_order_seed: string
  preregistered_presented_repetition: Record<string, number>
}
const live = JSON.parse(readFileSync(resolve(resultsPath), 'utf8')) as {
  protocol: string
  runs: Array<{
    case_id: string
    engine: 'production_baseline' | 'evidence_story_candidate'
    repetition: number
    output: unknown
  }>
}
if (live.protocol !== protocol.protocol) throw new Error('protocol mismatch')

const packet: Array<Record<string, unknown>> = []
const key: Array<Record<string, unknown>> = []
for (const [caseId, repetition] of Object.entries(
  protocol.preregistered_presented_repetition
)) {
  const baseline = live.runs.find(
    (run) =>
      run.case_id === caseId &&
      run.engine === 'production_baseline' &&
      run.repetition === repetition
  )
  const candidate = live.runs.find(
    (run) =>
      run.case_id === caseId &&
      run.engine === 'evidence_story_candidate' &&
      run.repetition === repetition
  )
  if (!baseline || !candidate)
    throw new Error(
      `missing preregistered output for ${caseId} repetition ${repetition}`
    )
  const candidateLeft =
    parseInt(
      createHash('sha256')
        .update(`${protocol.blind_order_seed}:${caseId}`)
        .digest('hex')
        .slice(0, 2),
      16
    ) %
      2 ===
    0
  const left = candidateLeft ? candidate : baseline
  const right = candidateLeft ? baseline : candidate
  const pairId = createHash('sha256')
    .update(`${protocol.protocol}:${caseId}:${repetition}`)
    .digest('hex')
    .slice(0, 12)
  packet.push({
    pair_id: pairId,
    case_id: caseId,
    repetition,
    A: left.output,
    B: right.output,
    rubric: {
      scroll_stop: null,
      curiosity: null,
      emotional_peak: null,
      tangible_need: null,
      causal_solution: null,
      credibility: null,
      power: null,
      publishability: null,
      preference: null,
      critique: '',
    },
  })
  key.push({
    pair_id: pairId,
    case_id: caseId,
    repetition,
    A: left.engine,
    B: right.engine,
  })
}

mkdirSync(outDir, { recursive: true })
writeFileSync(
  resolve(outDir, 'owner-packet.json'),
  `${JSON.stringify({ protocol: protocol.protocol, pairs: packet }, null, 2)}\n`
)
writeFileSync(
  resolve(outDir, 'owner-key.json'),
  `${JSON.stringify({ protocol: protocol.protocol, key }, null, 2)}\n`
)
console.log(`Wrote ${packet.length} blind pairs to ${outDir}`)
