// Deno copy of src/types/agents/creativeEngine.ts. See decisions/003 — KEEP IN SYNC
// with the Node-side copy.
import { z } from 'npm:zod@^3.24.0'

export const CREATIVE_TYPES = [
  'before_after', 'problem_visualization', 'product_result',
  'social_proof', 'testimonial_card', 'data_stats', 'lifestyle_aspiration'
] as const

export const CreativeItemSchema = z.object({
  type: z.enum(CREATIVE_TYPES),
  type_label: z.string(),      // human-readable label in Hebrew
  dalle_prompt: z.string(),    // the actual DALL-E 3 prompt Claude wrote
  image_url: z.string(),       // the generated image URL (or placeholder in mock)
  rationale: z.string(),       // why this creative for this offer
})

export const CreativeEngineResponseSchema = z.object({
  creatives: z.array(CreativeItemSchema).length(7),
})

export type CreativeEngineResponse = z.infer<typeof CreativeEngineResponseSchema>
export type CreativeItem = z.infer<typeof CreativeItemSchema>
