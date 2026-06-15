'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

import { Badge } from '@/components/ui/badge'
import { approveCandidate, rejectCandidate } from '@/lib/actions/discovery'
import { STAGE_BADGE_CLASS, STAGE_LABELS } from '@/lib/discovery/funnel'
import type { CandidateStage } from '@/lib/discovery/funnel'
import { hostnameOf } from '@/lib/facts/display'
import type { DiscoveryCandidate } from '@/lib/queries/discovery'

type HardFilterView = {
  status?: 'pass' | 'fail' | 'unknown_verify'
  evidence?: string
  source_url?: string | null
}

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
}

const HARD_FILTER_LABELS: Array<[keyof NonNullable<DeepView['hard_filters']>, string]> = [
  ['economics', 'Economics / EPC'],
  ['paid_traffic', 'Paid traffic'],
  ['monetization_integrity', 'Payment integrity'],
  ['scale_ceiling', 'Scale ceiling'],
]

const FILTER_STATUS_CLASS: Record<string, string> = {
  pass: 'bg-green-100 text-green-800',
  fail: 'bg-red-100 text-red-800',
  unknown_verify: 'bg-amber-100 text-amber-800',
}

export function CandidateRow({ candidate }: { candidate: DiscoveryCandidate }) {
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
        <Badge className={STAGE_BADGE_CLASS[stage]}>{STAGE_LABELS[stage]}</Badge>
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
            score {candidate.deep_score}
          </span>
        )}
        {deep?.recommended === false && (
          <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-800">
            not recommended
          </span>
        )}
      </div>

      {deep?.summary && <p className="text-sm">{deep.summary}</p>}
      {deep?.estimated_commission && (
        <p className="text-xs text-[var(--color-muted-foreground)]">
          Commission: {deep.estimated_commission}
        </p>
      )}

      {(deep?.estimated_epc_band || deep?.network) && (
        <p className="text-xs text-[var(--color-muted-foreground)]">
          {deep?.estimated_epc_band && <span>{deep.estimated_epc_band}</span>}
          {deep?.estimated_epc_band && deep?.network && <span> · </span>}
          {deep?.network && <span>network: {deep.network}</span>}
        </p>
      )}

      {deep?.hard_filters && (
        <div className="mt-1 flex flex-col gap-1">
          {HARD_FILTER_LABELS.map(([key, label]) => {
            const hf = deep.hard_filters?.[key]
            if (!hf?.status) return null
            return (
              <div key={key} className="flex items-baseline gap-2 text-xs">
                <span
                  className={`rounded px-1.5 py-0.5 ${FILTER_STATUS_CLASS[hf.status] ?? ''}`}
                >
                  {hf.status === 'unknown_verify' ? 'verify' : hf.status}
                </span>
                <span className="font-medium">{label}</span>
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
              Verify before budget:
            </span>{' '}
            {deep.must_verify_before_budget.join('; ')}
          </div>
        )}
      {candidate.rejection_reason && (
        <p className="text-xs text-red-700">
          Rejected at {candidate.rejection_stage}: {candidate.rejection_reason}
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
            className="rounded-md bg-[var(--color-foreground)] px-3 py-1 text-xs text-[var(--color-background)] disabled:opacity-50"
          >
            Approve → create offer
          </button>
          <button
            disabled={isPending}
            onClick={() => act(() => rejectCandidate(candidate.id))}
            className="rounded-md border border-[var(--color-border)] px-3 py-1 text-xs disabled:opacity-50"
          >
            Reject
          </button>
          {error && <span className="text-xs text-red-600">{error}</span>}
        </div>
      )}

      {candidate.promoted_offer_id && (
        <a
          href={`/offers/${candidate.promoted_offer_id}`}
          className="text-xs underline"
        >
          View created offer →
        </a>
      )}
    </div>
  )
}
