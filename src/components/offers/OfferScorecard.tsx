import {
  SCORE_DIMENSION_LABELS,
  type ScoreDimensions,
  type UnderwritingResponse,
} from '@/types/agents/underwriting'
import { cn } from '@/lib/utils'

// Score bands → color. 0-39 weak (red), 40-69 mixed (amber), 70-100 strong (green).
function bandClasses(score: number): { bar: string; text: string } {
  if (score >= 70) return { bar: 'bg-green-500', text: 'text-green-700' }
  if (score >= 40) return { bar: 'bg-amber-500', text: 'text-amber-700' }
  return { bar: 'bg-red-500', text: 'text-red-700' }
}

export function OfferScorecard({
  evaluation,
}: {
  evaluation: UnderwritingResponse | null
}) {
  // Defensive: the value is jsonb at the boundary, so guard against a non-
  // underwriting payload (no `scores`) instead of crashing on scores.economics.
  const scores = (evaluation as { payload?: { scores?: ScoreDimensions } } | null)
    ?.payload?.scores
  if (!evaluation || !scores) {
    return (
      <p className="text-sm text-[var(--color-muted-foreground)]">
        No analysis yet. Run an analysis to see the scorecard.
      </p>
    )
  }

  const keys = Object.keys(SCORE_DIMENSION_LABELS) as Array<keyof ScoreDimensions>
  const weighted = evaluation.payload.weighted_score
  const weightedBand = bandClasses(weighted)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-4 rounded-lg border border-[var(--color-border)] p-4">
        <div className="flex flex-col">
          <span className="text-xs uppercase tracking-wide text-[var(--color-muted-foreground)]">
            Weighted score
          </span>
          <span className={cn('text-4xl font-bold', weightedBand.text)}>
            {weighted}
            <span className="text-lg font-normal text-[var(--color-muted-foreground)]">
              /100
            </span>
          </span>
        </div>
        <div className="flex-1">
          <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--color-muted)]">
            <div
              className={cn('h-full rounded-full', weightedBand.bar)}
              style={{ width: `${weighted}%` }}
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
        {keys.map((key) => {
          const score = scores[key]
          const band = bandClasses(score)
          return (
            <div key={key} className="flex flex-col gap-1">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-sm">{SCORE_DIMENSION_LABELS[key]}</span>
                <span className={cn('text-sm font-semibold tabular-nums', band.text)}>
                  {score}
                </span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--color-muted)]">
                <div
                  className={cn('h-full rounded-full', band.bar)}
                  style={{ width: `${score}%` }}
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
