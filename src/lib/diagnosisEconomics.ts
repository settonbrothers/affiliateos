import { DiagnosisResponseSchema } from '@/types/agents/diagnosis'
import type { CampaignEconomicsAssessment } from '@/types/agents/offerEconomics'

export function applyDeterministicEconomics(
  raw: Record<string, unknown>,
  economics: CampaignEconomicsAssessment
): Record<string, unknown> {
  const parsed = DiagnosisResponseSchema.parse(raw)
  const mustStop =
    economics.data_sufficiency !== 'thin' &&
    economics.primary_economic_read === 'implausible'
  const provenLoss =
    economics.data_sufficiency === 'decision_ready' &&
    economics.primary_economic_read === 'unprofitable'
  if (!mustStop && !provenLoss) {
    return DiagnosisResponseSchema.parse({
      ...parsed,
      payload: { ...parsed.payload, economics_assessment: economics },
    }) as unknown as Record<string, unknown>
  }
  const reason = mustStop
    ? 'Current traffic cost requires an implausible approved conversion rate to break even.'
    : 'Decision-ready data shows CPA above the net value of an approved conversion.'
  return DiagnosisResponseSchema.parse({
    ...parsed,
    payload: {
      ...parsed.payload,
      diagnosis_summary: `${reason} ${parsed.payload.diagnosis_summary}`,
      primary_bottleneck: 'unit_economics',
      secondary_bottlenecks: [
        ...new Set([
          ...parsed.payload.secondary_bottlenecks,
          parsed.payload.primary_bottleneck,
        ]),
      ],
      recommended_action: 'stop_test',
      specific_recommendations: [
        {
          area: 'unit_economics',
          action:
            'Stop scaling and reduce traffic cost or improve the offer economics.',
          reasoning: reason,
        },
        ...parsed.payload.specific_recommendations,
      ],
      economics_assessment: economics,
    },
  }) as unknown as Record<string, unknown>
}
