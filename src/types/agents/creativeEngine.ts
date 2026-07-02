// Node-side CreativeEngineOrchestrator contract. See decisions/003 — KEEP IN SYNC
// with supabase/functions/_shared/types/creativeEngine.ts (Deno copy).
import { z } from 'zod'

export const CREATIVE_TYPES = [
  'before_after', 'problem_visualization', 'product_result',
  'social_proof', 'testimonial_card', 'data_stats', 'lifestyle_aspiration'
] as const

export const CreativeItemSchema = z.object({
  type: z.enum(CREATIVE_TYPES),
  type_label: z.string(),
  dalle_prompt: z.string(),
  image_url: z.string(),
  rationale: z.string(),
})

export const CreativeEngineResponseSchema = z.object({
  creatives: z.array(CreativeItemSchema).length(7),
})

export type CreativeEngineResponse = z.infer<typeof CreativeEngineResponseSchema>
export type CreativeItem = z.infer<typeof CreativeItemSchema>
