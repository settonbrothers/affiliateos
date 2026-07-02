// Node-side AvatarBuilderOrchestrator contract. See decisions/003 — KEEP IN SYNC
// with supabase/functions/_shared/types/avatarBuilder.ts (Deno copy).
import { z } from 'zod'

export const AvatarBuilderResponseSchema = z.object({
  who: z.string(),
  life_situation: z.string(),
  pain_points: z.array(z.string()).min(3),
  objections: z.array(z.string()).min(2),
  desires: z.array(z.string()).min(3),
  voice_of_customer: z.array(z.string()).min(3),
  transformation: z.string(),
  emotional_trigger: z.string(),
  trust_signals: z.array(z.string()).min(2),
})

export type AvatarBuilderResponse = z.infer<typeof AvatarBuilderResponseSchema>
export type AvatarBuilderPayload = AvatarBuilderResponse
