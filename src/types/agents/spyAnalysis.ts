// Node-side SpyAnalysisOrchestrator contract. KEEP IN SYNC
// with supabase/functions/_shared/types/spyAnalysis.ts (Deno copy).
import { z } from 'zod'

export const SpyAnalysisResponseSchema = z.object({
  input_summary: z.string(),
  hook_analysis: z.object({
    hooks_found: z.array(z.string()),
    hook_type: z.string(),
    hook_strength: z.enum(['strong', 'medium', 'weak']),
  }),
  meat_analysis: z.string(),
  cta_analysis: z.string(),
  psychological_triggers: z.array(z.string()),
  template_structure: z.string(),
  winning_elements: z.array(z.string()),
  style: z.enum(['emotional', 'technical', 'story', 'testimonial', 'data', 'mixed']),
  what_not_to_copy: z.array(z.string()),
  gaps_opportunities: z.array(z.string()),
})

export type SpyAnalysisResponse = z.infer<typeof SpyAnalysisResponseSchema>
