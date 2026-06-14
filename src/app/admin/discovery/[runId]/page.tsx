import { notFound } from 'next/navigation'

import { CandidateRow } from '@/components/discovery/CandidateRow'
import { FunnelBar } from '@/components/discovery/FunnelBar'
import {
  funnelCounts,
  rankAnalyzed,
  type CandidateLike,
} from '@/lib/discovery/funnel'
import { getDiscoveryRun, listCandidates } from '@/lib/queries/discovery'

export default async function DiscoveryRunPage({
  params,
}: {
  params: Promise<{ runId: string }>
}) {
  const { runId } = await params
  const run = await getDiscoveryRun(runId)
  if (!run) notFound()
  const candidates = await listCandidates(runId)

  const asLike = (c: (typeof candidates)[number]): CandidateLike => ({
    id: c.id,
    stage: c.stage as CandidateLike['stage'],
    triage_score: c.triage_score,
    deep_score: c.deep_score,
    rejection_stage: (c.rejection_stage as CandidateLike['stage']) ?? null,
  })

  const counts = funnelCounts(candidates.map(asLike))
  const rankedIds = new Set(
    rankAnalyzed(candidates.map(asLike)).map((c) => c.id)
  )
  const reached = candidates.filter((c) => rankedIds.has(c.id))
  const reachedSorted = [...reached].sort(
    (a, b) => (b.deep_score ?? 0) - (a.deep_score ?? 0)
  )
  const dropped = candidates.filter((c) => !rankedIds.has(c.id))

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Discovery run</h1>
        <p className="text-sm text-[var(--color-muted-foreground)]">
          {run.status}
          {run.total_cost_usd != null && ` · $${run.total_cost_usd.toFixed(2)}`}
          {run.error_message && ` · ${run.error_message}`}
        </p>
      </div>

      <FunnelBar counts={counts} />

      <section>
        <h2 className="mb-2 text-lg font-medium">
          Top candidates ({reachedSorted.length})
        </h2>
        {reachedSorted.map((c) => (
          <CandidateRow key={c.id} candidate={c} />
        ))}
        {reachedSorted.length === 0 && (
          <p className="text-sm text-[var(--color-muted-foreground)]">
            {run.status === 'completed'
              ? 'No candidates reached deep analysis.'
              : 'Scan still running — refresh in a moment.'}
          </p>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-lg font-medium">
          Dropped earlier ({dropped.length})
        </h2>
        {dropped.map((c) => (
          <CandidateRow key={c.id} candidate={c} />
        ))}
      </section>
    </div>
  )
}
