// Node copy. KEEP IN SYNC with supabase/functions/_shared/types/discovery.ts.
import { z } from 'zod'

// Triage scores a BATCH of candidates cheaply: is this a real, promotable
// affiliate offer, and how promising? One result per input, matched by index.
export const TriageItemSchema = z.object({
  index: z.number().int().min(0),
  is_affiliate_offer: z.boolean(),
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

// Deep analysis of one candidate against the advanced-affiliate rubric: a per
// hard-filter verdict with evidence, the items to verify before spending, an
// EPC band + network when derivable, and an overall recommendation.
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
})
export type DeepAnalysis = z.infer<typeof DeepAnalysisSchema>
export type HardFilter = z.infer<typeof HardFilterSchema>
