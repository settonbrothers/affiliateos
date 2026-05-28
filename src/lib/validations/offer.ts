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
})

export type OfferCreateInput = z.infer<typeof OfferCreateSchema>
