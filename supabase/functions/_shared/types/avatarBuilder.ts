// Deno copy of src/types/agents/avatarBuilder.ts. See decisions/003 — KEEP IN SYNC
// with the Node-side copy.
import { z } from 'npm:zod@^3.24.0'

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
