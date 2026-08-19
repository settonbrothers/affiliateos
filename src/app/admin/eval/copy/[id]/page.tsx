import { notFound } from 'next/navigation'
import type { SupabaseClient } from '@supabase/supabase-js'

import protocol from '../../../../../../brain-evals/copy-system-v2.protocol.json'
import {
  CopyEvalReview,
  type BlindPair,
} from '@/components/admin/CopyEvalReview'
import { CopyEvalRunner } from '@/components/admin/CopyEvalRunner'
import { brainSha256 } from '@/lib/copy/copyBrainContext'
import {
  isAnthropicCreditFailure,
  selectReviewablePairJobs,
} from '@/lib/copy/copyEvalReviewPolicy'
import { createClient } from '@/lib/supabase/server'

type RecordValue = Record<string, unknown>
type EvalRunRow = { id: string; status: string }
type EvalCaseRow = {
  id: string
  external_id: string
  split: string
  source_pack: unknown
  input_snapshot: unknown
  revealed_at: string | null
}
type EvalJobRow = {
  id: string
  case_id: string
  engine: string
  repetition: number
  status: string
  output_payload: unknown
  error_message: string | null
}
type EvalScoreRow = { case_id: string }
const record = (value: unknown): RecordValue | null =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as RecordValue)
    : null
const copyText = (output: unknown) => {
  const payload = record(record(output)?.payload)
  const variants = Array.isArray(payload?.variants) ? payload.variants : []
  const hebrew =
    variants.map(record).find((item) => item?.lang === 'he') ??
    variants.map(record).find(Boolean)
  if (!hebrew) return '[המנוע עצר לפני יצירת קופי]'
  return [hebrew.hook, hebrew.primary_text, hebrew.headline]
    .filter((item) => typeof item === 'string')
    .join('\n\n')
}

export default async function CopyEvalRunPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const db = (await createClient()) as SupabaseClient
  const [{ data: run }, { data: cases }, { data: jobs }, { data: scores }] =
    await Promise.all([
      db.from('copy_eval_runs').select('*').eq('id', id).maybeSingle(),
      db
        .from('copy_eval_cases')
        .select('id,external_id,split,source_pack,input_snapshot,revealed_at')
        .like('external_id', 'copy-brain-v5:%')
        .order('external_id'),
      db
        .from('copy_eval_jobs')
        .select(
          'id,case_id,engine,repetition,status,output_payload,error_message'
        )
        .eq('eval_run_id', id),
      db.from('copy_eval_owner_scores').select('case_id').eq('eval_run_id', id),
    ])
  if (!run) notFound()
  const evalRun = run as EvalRunRow
  const caseRows = (cases ?? []) as EvalCaseRow[]
  const jobRows = (jobs ?? []) as EvalJobRow[]
  const scoreRows = (scores ?? []) as EvalScoreRow[]
  const complete = jobRows.filter((job) => job.status === 'completed').length
  const failed = jobRows.filter((job) => job.status === 'failed').length
  const creditPaused = jobRows.some(
    (job) =>
      job.status === 'failed' && isAnthropicCreditFailure(job.error_message)
  )
  const scored = new Set(scoreRows.map((score) => score.case_id))
  const calibrationIds = new Set(
    caseRows
      .filter((item) => item.split === 'calibration')
      .map((item) => item.id)
  )
  const calibrationScored = [...scored].filter((caseId) =>
    calibrationIds.has(caseId)
  ).length
  const pairs: BlindPair[] = []
  for (const evalCase of caseRows) {
    const pack = record(evalCase.source_pack)
    const packId = String(
      pack?.id ?? evalCase.external_id.replace('copy-brain-v5:', '')
    )
    const repetition = Number(
      (protocol.preregistered_presented_repetition as Record<string, number>)[
        packId
      ] ?? 0
    )
    const pair = selectReviewablePairJobs({
      evalCase,
      jobs: jobRows,
      preregisteredRepetition: repetition,
      calibrationScored,
    })
    if (!pair) continue
    const { baseline, candidate } = pair
    const candidateLeft =
      Number.parseInt(
        brainSha256(`${protocol.blind_order_seed}:${packId}`).slice(0, 2),
        16
      ) %
        2 ===
      0
    const left = candidateLeft ? candidate : baseline
    const right = candidateLeft ? baseline : candidate
    pairs.push({
      caseId: evalCase.id,
      caseName: String(pack?.name ?? packId),
      split: evalCase.split,
      repetition,
      leftId: left.id,
      rightId: right.id,
      leftText: copyText(left.output_payload),
      rightText: copyText(right.output_payload),
      snapshot: evalCase.input_snapshot,
      alreadyScored: scored.has(evalCase.id),
    })
  }
  return (
    <div className="flex flex-col gap-6" dir="rtl">
      <div>
        <h1 className="text-2xl font-semibold">ריצת Copy Brain</h1>
        <p className="text-sm text-[var(--color-muted-foreground)]">
          {evalRun.status} · הושלמו {complete}/48 · נכשלו {failed} · דורגו{' '}
          {scored.size}/8
        </p>
      </div>
      <CopyEvalRunner
        runId={id}
        remaining={48 - complete - failed}
        failed={failed}
        creditPaused={creditPaused}
      />
      {pairs.length > 0 && (
        <CopyEvalReview
          runId={id}
          pairs={pairs}
          reviewMode={complete === 48 ? 'full' : 'partial_calibration'}
        />
      )}
      {complete < 48 && pairs.length === 0 && (
        <p className="text-sm text-[var(--color-muted-foreground)]">
          אין כרגע זוג כיול שנבחר מראש והושלם בשני המנועים. שני מקרי holdout
          נשארים נעולים עד שש הכרעות calibration והקפאה מפורשת.
        </p>
      )}
    </div>
  )
}
