import type { UnderwritingResponse } from '@/types/agents/underwriting'

import { EvidenceBars } from '@/components/crack-score/evidence-bars'

export function OfferScorecard({
  evaluation,
}: {
  evaluation: UnderwritingResponse | null
}) {
  return (
    <EvidenceBars
      scores={evaluation?.payload?.scores}
      weightedScore={evaluation?.payload?.weighted_score}
    />
  )
}
