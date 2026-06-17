// Node copy. KEEP IN SYNC with supabase/functions/_shared/types/discovery.ts.
import { z } from 'zod'

export const TRIAGE_CLASSIFICATIONS = ['offer', 'container', 'reject'] as const

// Triage classifies each candidate: 'offer' = a single concrete offer to deep-
// analyze; 'container' = a network/directory/listicle to MINE for the offers
// inside it; 'reject' = neither (blog, forum, junk).
export const TriageItemSchema = z.object({
  index: z.number().int().min(0),
  classification: z.enum(TRIAGE_CLASSIFICATIONS),
  score: z.number().int().min(0).max(100),
  reason: z.string().min(1),
})
export const TriageResponseSchema = z.object({
  results: z.array(TriageItemSchema),
})
export type TriageResponse = z.infer<typeof TriageResponseSchema>

export const HARD_FILTER_STATUSES = ['pass', 'fail', 'unknown_verify'] as const

export const HardFilterSchema = z.object({
  status: z.enum(HARD_FILTER_STATUSES),
  evidence: z.string(),
  source_url: z.string().nullable(),
})

export const SIGNAL_CONFIDENCES = ['high', 'medium', 'low', 'unknown'] as const

// A buyer-grade enrichment signal: a short value, how confident we are, and the
// evidence/source behind it.
export const SignalSchema = z.object({
  value: z.string(),
  confidence: z.enum(SIGNAL_CONFIDENCES),
  evidence: z.string(),
})

// Deep analysis of one candidate against the advanced-affiliate rubric: a per
// hard-filter verdict with evidence, the items to verify before spending, an
// EPC band + network when derivable, the enrichment signals, and an overall
// recommendation.
export const DeepAnalysisSchema = z.object({
  overall_score: z.number().int().min(0).max(100),
  summary: z.string().min(1),
  key_strengths: z.array(z.string()),
  key_risks: z.array(z.string()),
  estimated_commission: z.string().nullable(),
  estimated_epc_band: z.string().nullable(),
  network: z.string().nullable(),
  recommended: z.boolean(),
  must_verify_before_budget: z.array(z.string()),
  hard_filters: z.object({
    economics: HardFilterSchema,
    paid_traffic: HardFilterSchema,
    monetization_integrity: HardFilterSchema,
    scale_ceiling: HardFilterSchema,
  }),
  signals: z.object({
    demand_trend: SignalSchema,
    scale_proxy: SignalSchema,
    momentum: SignalSchema,
    best_payout_route: SignalSchema,
  }),
})
export type DeepAnalysis = z.infer<typeof DeepAnalysisSchema>
export type HardFilter = z.infer<typeof HardFilterSchema>
export type Signal = z.infer<typeof SignalSchema>

// Mining extracts the individual offers listed on a container page.
export const MinedOfferSchema = z.object({
  name: z.string().min(1),
  url: z.string().nullable(),
})
export const MineResponseSchema = z.object({
  offers: z.array(MinedOfferSchema),
})
export type MineResponse = z.infer<typeof MineResponseSchema>
