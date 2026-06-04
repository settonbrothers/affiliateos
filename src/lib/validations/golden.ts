import { z } from 'zod'

import { VERDICTS } from '@/types/agents/underwriting'

// A golden-set entry is hand-labeled ground truth. facts_snapshot is captured
// as JSON text in the form and parsed/validated server-side (same shape as
// extracted_facts rows: fact_type / fact_value / source_quote / confidence_score).
export const GoldenOfferSchema = z.object({
  external_id: z
    .string()
    .max(40, 'Keep the external id short.')
    .optional()
    .or(z.literal('')),
  offer_name: z.string().min(2, 'Name is required.'),
  vertical_id: z.string().uuid('Select a vertical.'),
  offer_url: z.string().url('Enter a valid URL.').optional().or(z.literal('')),
  expected_verdict: z.enum(VERDICTS, {
    errorMap: () => ({ message: 'Pick an expected verdict.' }),
  }),
  facts_snapshot: z.string().optional().or(z.literal('')),
  notes: z
    .string()
    .max(4000, 'Notes are too long.')
    .optional()
    .or(z.literal('')),
})

export type GoldenOfferInput = z.infer<typeof GoldenOfferSchema>
