import { getTranslations } from 'next-intl/server'
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

  // Deep-analysis quality gate: a low deep_score (e.g. a directory/listicle the
  // deep read flagged) must NOT sit in "Top candidates" looking approvable.
  const RECOMMENDED_MIN_SCORE = 55
  const isStrong = (c: (typeof candidates)[number]): boolean =>
    (c.deep_score ?? 0) >= RECOMMENDED_MIN_SCORE ||
    c.stage === 'approved' ||
    c.stage === 'promoted'

  const counts = funnelCounts(candidates.map(asLike))
  const rankedIds = new Set(
    rankAnalyzed(candidates.map(asLike)).map((c) => c.id)
  )
  const reached = candidates
    .filter((c) => rankedIds.has(c.id))
    .sort((a, b) => (b.deep_score ?? 0) - (a.deep_score ?? 0))
  const strong = reached.filter(isStrong)
  const weak = reached.filter((c) => !isStrong(c))
  const dropped = candidates.filter((c) => !rankedIds.has(c.id))
  const t = await getTranslations('discoveryAdmin')

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">{t('runTitle')}</h1>
        <p className="text-sm text-[var(--color-muted-foreground)]">
          {run.status}
          {run.total_cost_usd != null && ` · $${run.total_cost_usd.toFixed(2)}`}
          {run.error_message && ` · ${run.error_message}`}
        </p>
      </div>

      <FunnelBar counts={counts} />

      <section>
        <h2 className="mb-2 text-lg font-medium">
          {t('topCandidates')} ({strong.length})
        </h2>
        {strong.map((c) => (
          <CandidateRow key={c.id} candidate={c} />
        ))}
        {strong.length === 0 && (
          <p className="text-sm text-[var(--color-muted-foreground)]">
            {run.status === 'completed' ? t('noStrong') : t('scanRunning')}
          </p>
        )}
      </section>

      {weak.length > 0 && (
        <section>
          <h2 className="mb-1 text-lg font-medium">
            {t('lowConfidence')} ({weak.length})
          </h2>
          <p className="mb-2 text-xs text-[var(--color-muted-foreground)]">
            {t('lowConfidenceHint', { min: RECOMMENDED_MIN_SCORE })}
          </p>
          {weak.map((c) => (
            <CandidateRow key={c.id} candidate={c} />
          ))}
        </section>
      )}

      <section>
        <h2 className="mb-2 text-lg font-medium">
          {t('droppedEarlier')} ({dropped.length})
        </h2>
        {dropped.map((c) => (
          <CandidateRow key={c.id} candidate={c} />
        ))}
      </section>
    </div>
  )
}
