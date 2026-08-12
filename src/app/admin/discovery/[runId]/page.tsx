import { getLocale, getTranslations } from 'next-intl/server'
import { notFound } from 'next/navigation'

import { CandidateRow } from '@/components/discovery/CandidateRow'
import { FunnelBar } from '@/components/discovery/FunnelBar'
import {
  funnelCounts,
  rankAnalyzed,
  type CandidateLike,
} from '@/lib/discovery/funnel'
import { ResumeRunButton } from '@/components/discovery/ResumeRunButton'
import { TranslationBatchFiller } from '@/components/i18n/TranslationBatchFiller'
import { getTranslatedPayload } from '@/lib/i18n/translatedPayload'
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
  const reachedRaw = candidates
    .filter((c) => rankedIds.has(c.id))
    .sort((a, b) => (b.deep_score ?? 0) - (a.deep_score ?? 0))
  // Show the deep-analysis prose in the viewer's locale (English payload kept
  // as the canonical source). Only the analyzed candidates carry deep_analysis.
  // This is a cache READ; the cache is filled after paint by the
  // TranslationBatchFiller below — without it this page always rendered
  // English, because nothing ever populated the cache it was reading.
  // deep_score/stage are columns, so isStrong still works on translated copies.
  const locale = await getLocale()
  const reached = await Promise.all(
    reachedRaw.map(async (c) => ({
      ...c,
      deep_analysis: await getTranslatedPayload(
        'discovery_candidates',
        c.id,
        locale,
        c.deep_analysis
      ),
    }))
  )
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

      {/* Candidates still waiting at 'triaged' — the deep pass ran out of clock
          or hit its target. The work is all in the database, so it can simply
          be continued. */}
      {candidates.filter((c) => c.stage === 'triaged').length > 0 && (
        <ResumeRunButton
          runId={run.id}
          pending={candidates.filter((c) => c.stage === 'triaged').length}
        />
      )}

      {/* Fills the translation cache the render above reads from. Scoped to the
          candidates actually worth reading (and capped in the action), so a
          100-candidate run doesn't turn one page view into 100 Haiku calls. */}
      <TranslationBatchFiller
        sourceTable="discovery_candidates"
        sourceIds={strong.filter((c) => c.deep_analysis).map((c) => c.id)}
        locale={locale}
      />

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
