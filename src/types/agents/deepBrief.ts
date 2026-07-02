// Node-side DeepBriefOrchestrator contract. See decisions/003 — KEEP IN SYNC
// with supabase/functions/_shared/types/deepBrief.ts (Deno copy).
import { z } from 'zod'

export const DeepBriefPayloadSchema = z.object({
  what_we_sell: z.string(),
  main_differentiator: z.string(),
  timing: z.string(),
  must_know: z.array(z.string()).min(3),
  emotional_connection: z.string(),
  normal_state_meaning: z.string(),
  control_in_hands: z.string(),
  proofs: z.array(z.string()),
  real_confidence: z.string(),
  crack_post_params: z.object({
    problem_pain: z.string(),
    solution: z.string(),
    urgency: z.string(),
    agenda_proof: z.string(),
    benefit_amplified: z.string(),
    belief_it_will_happen: z.string(),
    cta_placeholder: z.string(),
  }),
  search_summary: z.string().optional(),
})

export const DeepBriefResponseSchema = DeepBriefPayloadSchema

export type DeepBriefResponse = z.infer<typeof DeepBriefResponseSchema>
export type DeepBriefPayload = z.infer<typeof DeepBriefPayloadSchema>
