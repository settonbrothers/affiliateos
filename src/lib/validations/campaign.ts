import { z } from 'zod'

// Manual results entry. Inputs come from a form as strings, so coerce.
export const CampaignResultsSchema = z.object({
  spend_usd: z.coerce.number().min(0, 'Must be ≥ 0.'),
  impressions: z.coerce.number().int().min(0, 'Must be ≥ 0.'),
  clicks: z.coerce.number().int().min(0, 'Must be ≥ 0.'),
  landing_views: z.coerce.number().int().min(0, 'Must be ≥ 0.'),
  conversions: z.coerce.number().int().min(0, 'Must be ≥ 0.'),
  revenue_usd: z.coerce.number().min(0, 'Must be ≥ 0.'),
  days_running: z.coerce.number().int().min(0, 'Must be ≥ 0.'),
})

export type CampaignResultsInput = z.infer<typeof CampaignResultsSchema>
