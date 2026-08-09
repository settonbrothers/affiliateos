'use client'

import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

import { Badge } from '@/components/ui/badge'
import { approveCandidate, rejectCandidate } from '@/lib/actions/discovery'
import { STAGE_BADGE_CLASS } from '@/lib/discovery/funnel'
import type { StoredDeepAnalysis } from '@/lib/discovery/promote'
import { deriveRecommended } from '@/lib/discovery/quality'
import type { CandidateStage } from '@/lib/discovery/funnel'
import { hostnameOf } from '@/lib/facts/display'
import type { DiscoveryCandidate } from '@/lib/queries/discovery'

type HardFilterView = {
  status?: 'pass' | 'fail' | 'unknown_verify'
  evidence?: string
  source_url?: string | null
}

type SignalView = { value?: string; confidence?: string; evidence?: string }

type DeepView = {
  summary?: string
  // key_strengths / key_risks were absent from this type entirely: the model
  // produces them, they are stored and even translated, and nothing read them.
  key_strengths?: string[]
  key_risks?: string[]
  estimated_commission?: string | null
  estimated_epc_band?: string | null
  network?: string | null
  recommended?: boolean
  must_verify_before_budget?: string[]
  hard_filters?: {
    economics?: HardFilterView
    paid_traffic?: HardFilterView
    monetization_integrity?: HardFilterView
    scale_ceiling?: HardFilterView
  }
  signals?: {
    demand_trend?: SignalView
    scale_proxy?: SignalView
    momentum?: SignalView
    best_payout_route?: SignalView
  }
}

const HARD_FILTER_LABELS: Array<[keyof NonNullable<DeepView['hard_filters']>, string]> = [
  ['economics', 'hfEconomics'],
  ['paid_traffic', 'hfPaidTraffic'],
  ['monetization_integrity', 'hfPaymentIntegrity'],
  ['scale_ceiling', 'hfScaleCeiling'],
]

// Dark-app chips. These were light Tailwind swatches (bg-green-100) left over
// from before the AFFEX reskin, glowing on a near-black page.
const FILTER_STATUS_STYLE: Record<string, React.CSSProperties> = {
  pass: { color: '#7BD88F', border: '1px solid rgba(123,216,143,0.35)' },
  fail: { color: '#F87171', border: '1px solid rgba(248,113,113,0.35)' },
  unknown_verify: {
    color: 'var(--amber-text)',
    border: '1px solid var(--amber-border)',
    background: 'var(--amber-bg)',
  },
}

const chip: React.CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: '10px',
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  padding: '2px 6px',
  whiteSpace: 'nowrap',
}

const SIGNAL_LABELS: Array<[keyof NonNullable<DeepView['signals']>, string]> = [
  ['best_payout_route', 'sigBestPayout'],
  ['demand_trend', 'sigDemand'],
  ['scale_proxy', 'sigAtScale'],
  ['momentum', 'sigMomentum'],
]

const STAGE_LABEL_KEYS: Record<CandidateStage, string> = {
  discovered: 'funnelDiscovered',
  triaged: 'funnelPassedTriage',
  analyzed: 'funnelDeepAnalyzed',
  approved: 'funnelApproved',
  rejected: 'stageRejected',
  promoted: 'stagePromoted',
}

const SIGNAL_CONFIDENCE_STYLE: Record<string, React.CSSProperties> = {
  high: { color: '#7BD88F' },
  medium: { color: '#9CC5FF' },
  low: { color: '#8A8A88' },
  unknown: { color: 'var(--amber-text)' },
}

export function CandidateRow({ candidate }: { candidate: DiscoveryCandidate }) {
  const t = useTranslations('discoveryAdmin')
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const stage = candidate.stage as CandidateStage
  const deep = candidate.deep_analysis as DeepView | null

  const act = (fn: () => Promise<{ error: string } | void>) =>
    startTransition(async () => {
      const res = await fn()
      if (res?.error) setError(res.error)
      else {
        setError(null)
        router.refresh()
      }
    })

  return (
    <div className="flex flex-col gap-1 border-b border-[var(--color-border)] py-3">
      <div className="flex items-center gap-2">
        <Badge className={STAGE_BADGE_CLASS[stage]}>
          {t(STAGE_LABEL_KEYS[stage])}
        </Badge>
        <span className="font-medium">{candidate.name}</span>
        {candidate.url && (
          <a
            href={candidate.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs underline"
          >
            {hostnameOf(candidate.url)} ↗
          </a>
        )}
        {candidate.deep_score != null && (
          <span className="text-xs text-[var(--color-muted-foreground)]">
            {t('score', { n: candidate.deep_score })}
          </span>
        )}
        {/* The triage score is stored on every candidate and was never shown,
            even though it decides which ones reach the deep-analysis cap. */}
        {candidate.triage_score != null && (
          <span style={{ ...chip, color: '#8A8A88' }}>
            {t('triageScore', { n: candidate.triage_score })}
          </span>
        )}
        {/* Whether a candidate came from search or was mined out of a directory
            only ever existed as a marker inside raw_snippet. */}
        {candidate.raw_snippet?.startsWith('[mined from') && (
          <span style={{ ...chip, color: '#9CC5FF' }}>{t('minedFrom')}</span>
        )}
        {/* Derived, not read. The model's own `recommended` flag disagreed with
            its filters on 3 of 70 stored candidates — including one recommended
            with paid_traffic marked `fail`, i.e. the offer forbids the traffic
            the operator would be buying. */}
        {deep && !deriveRecommended(deep as StoredDeepAnalysis) && (
          <span
            style={{
              ...chip,
              color: 'var(--amber-text)',
              border: '1px solid var(--amber-border)',
              background: 'var(--amber-bg)',
            }}
          >
            {t('notRecommended')}
          </span>
        )}
      </div>

      {deep?.summary && <p className="text-sm">{deep.summary}</p>}
      {deep?.estimated_commission && (
        <p className="text-xs text-[var(--color-muted-foreground)]">
          {t('commission')} {deep.estimated_commission}
        </p>
      )}

      {(deep?.estimated_epc_band || deep?.network) && (
        <p className="text-xs text-[var(--color-muted-foreground)]">
          {deep?.estimated_epc_band && <span>{deep.estimated_epc_band}</span>}
          {deep?.estimated_epc_band && deep?.network && <span> · </span>}
          {deep?.network && <span>{t('network', { name: deep.network })}</span>}
        </p>
      )}

      {deep?.hard_filters && (
        <div className="mt-1 flex flex-col gap-1">
          {HARD_FILTER_LABELS.map(([key, labelKey]) => {
            const hf = deep.hard_filters?.[key]
            if (!hf?.status) return null
            return (
              <div key={key} className="flex flex-wrap items-baseline gap-2 text-xs">
                <span style={{ ...chip, ...(FILTER_STATUS_STYLE[hf.status] ?? {}) }}>
                  {hf.status === 'unknown_verify' ? t('verify') : hf.status}
                </span>
                <span className="font-medium">{t(labelKey)}</span>
                {hf.evidence && (
                  <span className="text-[var(--color-muted-foreground)]">
                    {hf.evidence}
                  </span>
                )}
                {/* The prompt requires a source_url for every filter verdict and
                    it is stored — but only the prose was rendered, so there was
                    no way to check any claim against where it came from. */}
                {hf.source_url && (
                  <a
                    href={hf.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline"
                    style={{ color: '#9CC5FF' }}
                  >
                    {hostnameOf(hf.source_url)} ↗
                  </a>
                )}
              </div>
            )
          })}
        </div>
      )}

      {deep?.must_verify_before_budget &&
        deep.must_verify_before_budget.length > 0 && (
          <div className="mt-1 text-xs">
            <span
              className="font-medium"
              style={{ color: 'var(--amber-text)' }}
            >
              {t('verifyBeforeBudget')}
            </span>{' '}
            {deep.must_verify_before_budget.join('; ')}
          </div>
        )}

      {(deep?.key_strengths?.length || deep?.key_risks?.length) && (
        <div className="mt-1 flex flex-col gap-1 text-xs">
          {deep?.key_strengths && deep.key_strengths.length > 0 && (
            <div className="flex flex-wrap items-baseline gap-2">
              <span style={{ ...chip, color: '#7BD88F' }}>{t('strengths')}</span>
              <span className="text-[var(--color-muted-foreground)]">
                {deep.key_strengths.join('; ')}
              </span>
            </div>
          )}
          {deep?.key_risks && deep.key_risks.length > 0 && (
            <div className="flex flex-wrap items-baseline gap-2">
              <span style={{ ...chip, color: '#F87171' }}>{t('risks')}</span>
              <span className="text-[var(--color-muted-foreground)]">
                {deep.key_risks.join('; ')}
              </span>
            </div>
          )}
        </div>
      )}

      {deep?.signals && (
        <div className="mt-1 flex flex-col gap-1">
          {SIGNAL_LABELS.map(([key, labelKey]) => {
            const sig = deep.signals?.[key]
            if (!sig?.value) return null
            return (
              <div key={key} className="flex flex-wrap items-baseline gap-2 text-xs">
                <span className="w-24 shrink-0 font-medium">{t(labelKey)}</span>
                <span>{sig.value}</span>
                {/* Only value + confidence surfaced; the evidence behind each
                    signal was stored, translated, and never read. */}
                {sig.evidence && (
                  <span className="text-[var(--color-muted-foreground)]">
                    {sig.evidence}
                  </span>
                )}
                {sig.confidence && (
                  <span
                    style={{
                      ...chip,
                      ...(SIGNAL_CONFIDENCE_STYLE[sig.confidence] ?? {}),
                    }}
                  >
                    {sig.confidence}
                  </span>
                )}
              </div>
            )
          })}
        </div>
      )}
      {candidate.rejection_reason && (
        <p className="text-xs text-red-700">
          {t('rejectedAt', { stage: candidate.rejection_stage ?? '' })}{' '}
          {candidate.rejection_reason}
        </p>
      )}
      {!deep?.summary && candidate.triage_reason && (
        <p className="text-xs text-[var(--color-muted-foreground)]">
          {candidate.triage_reason}
        </p>
      )}

      {(stage === 'analyzed' || stage === 'triaged') && (
        <div className="mt-1 flex items-center gap-2">
          <button
            disabled={isPending}
            onClick={() => act(() => approveCandidate(candidate.id))}
            className="rounded-none bg-[var(--color-foreground)] px-3 py-1 text-xs text-[var(--color-background)] disabled:opacity-50"
          >
            {t('approveCreateOffer')}
          </button>
          <button
            disabled={isPending}
            onClick={() => act(() => rejectCandidate(candidate.id))}
            className="rounded-none border border-[var(--color-border)] px-3 py-1 text-xs disabled:opacity-50"
          >
            {t('reject')}
          </button>
          {error && <span className="text-xs text-red-600">{error}</span>}
        </div>
      )}

      {candidate.promoted_offer_id && (
        <a
          href={`/offers/${candidate.promoted_offer_id}`}
          className="text-xs underline"
        >
          {t('viewCreatedOffer')}
        </a>
      )}
    </div>
  )
}
