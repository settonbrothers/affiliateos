import { z } from 'zod'

// Manual results entry. Inputs come from a form as strings, so coerce.
export const CampaignResultsSchema = z
  .object({
    spend_amount: z.coerce.number().min(0, 'Must be ≥ 0.'),
    spend_currency: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z]{3}$/),
    impressions: z.coerce.number().int().min(0, 'Must be ≥ 0.'),
    clicks: z.coerce.number().int().min(0, 'Must be ≥ 0.'),
    landing_views: z.coerce.number().int().min(0, 'Must be ≥ 0.'),
    affiliate_clicks: z.coerce.number().int().min(0, 'Must be ≥ 0.'),
    conversions: z.coerce.number().int().min(0, 'Must be ≥ 0.'),
    approved_conversions: z.coerce.number().int().min(0, 'Must be ≥ 0.'),
    reversed_conversions: z.coerce.number().int().min(0, 'Must be ≥ 0.'),
    commission_amount: z.coerce.number().min(0, 'Must be ≥ 0.'),
    commission_currency: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z]{3}$/),
    days_running: z.coerce.number().int().min(0, 'Must be ≥ 0.'),
  })
  .superRefine((value, ctx) => {
    if (value.landing_views > value.clicks) {
      ctx.addIssue({
        code: 'custom',
        path: ['landing_views'],
        message: 'Cannot exceed ad clicks.',
      })
    }
    if (value.affiliate_clicks > value.landing_views) {
      ctx.addIssue({
        code: 'custom',
        path: ['affiliate_clicks'],
        message: 'Cannot exceed landing views.',
      })
    }
    if (value.approved_conversions > value.conversions) {
      ctx.addIssue({
        code: 'custom',
        path: ['approved_conversions'],
        message: 'Cannot exceed raw conversions.',
      })
    }
    if (value.reversed_conversions > value.approved_conversions) {
      ctx.addIssue({
        code: 'custom',
        path: ['reversed_conversions'],
        message: 'Cannot exceed approved conversions.',
      })
    }
  })

export type CampaignResultsInput = z.infer<typeof CampaignResultsSchema>
