// Deno copy of src/types/agents/spyAnalysis.ts. KEEP IN SYNC with the Node-side copy.
import { z } from 'npm:zod@^3.24.0'

export const SpyAnalysisResponseSchema = z.object({
  input_summary: z.string(),           // מה ראינו (N מודעות / דפים)
  hook_analysis: z.object({
    hooks_found: z.array(z.string()),  // הוקים שזיהינו
    hook_type: z.string(),             // curiosity / pain / benefit / etc
    hook_strength: z.enum(['strong', 'medium', 'weak']),
  }),
  meat_analysis: z.string(),           // ניתוח הגוף — מה הם מדגישים
  cta_analysis: z.string(),            // ניתוח CTA — מה הם מבקשים ואיך
  psychological_triggers: z.array(z.string()),  // triggers שמשתמשים
  template_structure: z.string(),      // AIDA/PAS/Story/etc
  winning_elements: z.array(z.string()),  // מה נראה מנצח
  style: z.enum(['emotional', 'technical', 'story', 'testimonial', 'data', 'mixed']),
  what_not_to_copy: z.array(z.string()),  // מה לא לעשות
  gaps_opportunities: z.array(z.string()),  // הזדמנויות שהם מפספסים
})

export type SpyAnalysisResponse = z.infer<typeof SpyAnalysisResponseSchema>
