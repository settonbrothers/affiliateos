import { Badge } from '@/components/ui/badge'
import {
  VERDICT_LABELS,
  type UnderwritingResponse,
} from '@/types/agents/underwriting'

// Verdict tier → badge color, so "reject" vs "strong_test" reads at a glance.
const VERDICT_BADGE_CLASS: Record<string, string> = {
  reject: 'border-red-300 bg-red-100 text-red-800',
  watch: 'border-amber-300 bg-amber-100 text-amber-800',
  organic_only: 'border-amber-300 bg-amber-100 text-amber-800',
  seo_review_only: 'border-amber-300 bg-amber-100 text-amber-800',
  small_paid_test: 'border-green-300 bg-green-100 text-green-800',
  strong_test: 'border-green-300 bg-green-100 text-green-800',
  strategic_opportunity: 'border-emerald-400 bg-emerald-100 text-emerald-900',
  high_ceiling_opportunity: 'border-emerald-400 bg-emerald-100 text-emerald-900',
}

export function OfferVerdict({
  evaluation,
}: {
  evaluation: UnderwritingResponse | null
}) {
  if (!evaluation) {
    return (
      <p className="text-sm text-[var(--color-muted-foreground)]">
        No verdict yet. Run an analysis first.
      </p>
    )
  }

  const p = evaluation.payload

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <Badge className={VERDICT_BADGE_CLASS[p.verdict]}>
          {VERDICT_LABELS[p.verdict]}
        </Badge>
        {p.recommended_channel && (
          <span className="text-sm text-[var(--color-muted-foreground)]">
            Channel: {p.recommended_channel}
          </span>
        )}
      </div>

      <div>
        <h3 className="text-sm font-medium">Why test</h3>
        <p className="text-sm">{p.main_reason_to_test}</p>
      </div>
      <div>
        <h3 className="text-sm font-medium">Why avoid</h3>
        <p className="text-sm">{p.main_reason_to_avoid}</p>
      </div>

      {p.recommended_test_budget_usd !== null && (
        <div className="text-sm">
          Recommended test budget: ${p.recommended_test_budget_usd}
        </div>
      )}

      {p.kill_criteria.length > 0 && (
        <div>
          <h3 className="text-sm font-medium">Kill criteria</h3>
          <ul className="list-disc pl-5 text-sm">
            {p.kill_criteria.map((criterion) => (
              <li key={criterion}>{criterion}</li>
            ))}
          </ul>
        </div>
      )}

      {evaluation.facts.length > 0 && (
        <div>
          <h3 className="text-sm font-medium">
            Facts considered ({evaluation.facts.length})
          </h3>
          <ul className="mt-1 space-y-1 text-sm">
            {evaluation.facts.map((f, i) => (
              <li key={`${f.statement}-${i}`} className="flex gap-2">
                <span className="font-medium">{f.statement}</span>
                {f.source && (
                  <span className="text-xs text-[var(--color-muted-foreground)]">
                    — “{f.source}”
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {evaluation.human_review_required &&
        evaluation.human_review_reasons.length > 0 && (
          <div className="rounded-md border border-yellow-600/50 bg-yellow-50 p-3 text-sm dark:bg-yellow-950/40">
            <p className="font-medium">Human review recommended</p>
            <ul className="mt-1 list-disc pl-5">
              {evaluation.human_review_reasons.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          </div>
        )}
    </div>
  )
}
