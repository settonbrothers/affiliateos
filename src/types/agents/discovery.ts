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

// Deep analysis of one candidate's page: a quality read with the key facts that
// justify the score, so the admin sees WHY it ranked where it did.
export const DeepAnalysisSchema = z.object({
  overall_score: z.number().int().min(0).max(100),
  summary: z.string().min(1),
  key_strengths: z.array(z.string()),
  key_risks: z.array(z.string()),
  estimated_commission: z.string().nullable(),
  recommended: z.boolean(),
})
export type DeepAnalysis = z.infer<typeof DeepAnalysisSchema>
