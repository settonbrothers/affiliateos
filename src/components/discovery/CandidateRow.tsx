'use client'

import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

import { Badge } from '@/components/ui/badge'
import { approveCandidate, rejectCandidate } from '@/lib/actions/discovery'
import { STAGE_BADGE_CLASS } from '@/lib/discovery/funnel'
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

const FILTER_STATUS_CLASS: Record<string, string> = {
  pass: 'bg-green-100 text-green-800',
  fail: 'bg-red-100 text-red-800',
  unknown_verify: 'bg-amber-100 text-amber-800',
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

const SIGNAL_CONFIDENCE_CLASS: Record<string, string> = {
  high: 'bg-green-100 text-green-800',
  medium: 'bg-blue-100 text-blue-800',
  low: 'bg-zinc-100 text-zinc-600',
  unknown: 'bg-amber-100 text-amber-800',
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
        {deep?.recommended === false && (
          <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-800">
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
              <div key={key} className="flex items-baseline gap-2 text-xs">
                <span
                  className={`rounded px-1.5 py-0.5 ${FILTER_STATUS_CLASS[hf.status] ?? ''}`}
                >
                  {hf.status === 'unknown_verify' ? t('verify') : hf.status}
                </span>
                <span className="font-medium">{t(labelKey)}</span>
                {hf.evidence && (
                  <span className="text-[var(--color-muted-foreground)]">
                    — {hf.evidence}
                  </span>
                )}
              </div>
            )
          })}
        </div>
      )}

      {deep?.must_verify_before_budget &&
        deep.must_verify_before_budget.length > 0 && (
          <div className="mt-1 text-xs">
            <span className="font-medium text-amber-800">
              {t('verifyBeforeBudget')}
            </span>{' '}
            {deep.must_verify_before_budget.join('; ')}
          </div>
        )}

      {deep?.signals && (
        <div className="mt-1 flex flex-col gap-1">
          {SIGNAL_LABELS.map(([key, labelKey]) => {
            const sig = deep.signals?.[key]
            if (!sig?.value) return null
            return (
              <div key={key} className="flex items-baseline gap-2 text-xs">
                <span className="w-24 shrink-0 font-medium">{t(labelKey)}</span>
                <span>{sig.value}</span>
                {sig.confidence && (
                  <span
                    className={`rounded px-1 py-0.5 ${SIGNAL_CONFIDENCE_CLASS[sig.confidence] ?? ''}`}
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
