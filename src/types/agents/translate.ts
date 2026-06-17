// Node copy. KEEP IN SYNC with supabase/functions/_shared/types/translate.ts.
import { z } from 'zod'

// Translation is keyed by `id` (the source field path) so the translated text
// goes back exactly where it came from. One item in → one item out.
export const TranslateItemSchema = z.object({
  id: z.string(),
  text: z.string(),
})
export const TranslateResponseSchema = z.object({
  items: z.array(TranslateItemSchema),
})
export type TranslateResponse = z.infer<typeof TranslateResponseSchema>
