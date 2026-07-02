// Deno Zod schema for DiagnosisV2Orchestrator output.
import { z } from 'npm:zod@^3.24.0'

export const CreativeAnalysisItemSchema = z.object({
  hook: z.string(),
  hook_type: z.enum([
    'curiosity',
    'pain',
    'social_proof',
    'pattern_interrupt',
    'data',
    'story',
    'challenge',
    'benefit',
    'fear',
    'authority',
  ]),
  what_worked: z.string(),
  what_didnt: z.string(),
  is_winner: z.boolean(),
  winner_reason: z.string().optional(),
})

export const DiagnosisV2ResponseSchema = z.object({
  creative_analysis: z.array(CreativeAnalysisItemSchema),
  overall_assessment: z.string(),
  next_campaign_recommendations: z.array(z.string()).min(2),
  winning_hooks: z.array(z.string()),
})

export type CreativeAnalysisItem = z.infer<typeof CreativeAnalysisItemSchema>
export type DiagnosisV2Response = z.infer<typeof DiagnosisV2ResponseSchema>
