'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

import { Badge } from '@/components/ui/badge'
import { approveCandidate, rejectCandidate } from '@/lib/actions/discovery'
import { STAGE_BADGE_CLASS, STAGE_LABELS } from '@/lib/discovery/funnel'
import type { CandidateStage } from '@/lib/discovery/funnel'
import { hostnameOf } from '@/lib/facts/display'
import type { DiscoveryCandidate } from '@/lib/queries/discovery'

export function CandidateRow({ candidate }: { candidate: DiscoveryCandidate }) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const stage = candidate.stage as CandidateStage
  const deep = candidate.deep_analysis as
    | { summary?: string; estimated_commission?: string | null }
    | null

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
      </div>

      {deep?.summary && <p className="text-sm">{deep.summary}</p>}
      {deep?.estimated_commission && (
        <p className="text-xs text-[var(--color-muted-foreground)]">
          Commission: {deep.estimated_commission}
        </p>
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
