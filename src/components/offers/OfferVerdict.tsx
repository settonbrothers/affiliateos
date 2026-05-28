import { Badge } from '@/components/ui/badge'
import {
  VERDICT_LABELS,
  type UnderwritingResponse,
} from '@/types/agents/underwriting'

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
        <Badge>{VERDICT_LABELS[p.verdict]}</Badge>
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
    </div>
  )
}
