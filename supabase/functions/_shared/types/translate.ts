// Deno copy. KEEP IN SYNC with src/types/agents/translate.ts.
import { z } from 'npm:zod@^3.24.0'

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
