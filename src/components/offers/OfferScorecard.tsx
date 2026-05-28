import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  SCORE_DIMENSION_LABELS,
  type ScoreDimensions,
  type UnderwritingResponse,
} from '@/types/agents/underwriting'

export function OfferScorecard({
  evaluation,
}: {
  evaluation: UnderwritingResponse | null
}) {
  if (!evaluation) {
    return (
      <p className="text-sm text-[var(--color-muted-foreground)]">
        No analysis yet. Run an analysis to see the scorecard.
      </p>
    )
  }

  const scores = evaluation.payload.scores
  const keys = Object.keys(SCORE_DIMENSION_LABELS) as Array<keyof ScoreDimensions>

  return (
    <div>
      <div className="mb-4 text-sm">
        Weighted score:{' '}
        <span className="font-semibold">{evaluation.payload.weighted_score}</span>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        {keys.map((key) => (
          <Card key={key}>
            <CardHeader className="p-4 pb-1">
              <CardTitle className="text-sm">
                {SCORE_DIMENSION_LABELS[key]}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <span className="text-2xl font-semibold">{scores[key]}</span>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
