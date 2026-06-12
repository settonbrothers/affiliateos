import { z } from 'zod'

export const OfferCreateSchema = z.object({
  name: z.string().min(2, 'Name is required.'),
  vertical_id: z.string().uuid('Select a vertical.'),
  website_url: z
    .string()
    .url('Enter a valid URL.')
    .optional()
    .or(z.literal('')),
  affiliate_program_url: z
    .string()
    .url('Enter a valid URL.')
    .optional()
    .or(z.literal('')),
  operator_notes: z
    .string()
    .max(8000, 'Notes are too long — keep under 8000 characters.')
    .optional()
    .or(z.literal('')),
})

export type OfferCreateInput = z.infer<typeof OfferCreateSchema>

// Edit takes the same shape — the server action wires it to UPDATE rather than INSERT.
export const OfferUpdateSchema = OfferCreateSchema
export type OfferUpdateInput = z.infer<typeof OfferUpdateSchema>

// Mirrors the offer_status enum (migration 0005). Kept as a const tuple so
// both z.enum and UI <select> options derive from one source.
export const OFFER_STATUSES = [
  'draft',
  'needs_source_ingestion',
  'ready_for_analysis',
  'ai_analyzed',
  'published',
  'rejected',
  'deprecated',
] as const

export const OfferStatusUpdateSchema = z.object({
  status: z.enum(OFFER_STATUSES),
})
