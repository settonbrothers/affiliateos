import { z } from 'zod'

import { TRAFFIC_CHANNELS } from '@/types/agents/testKit'

export const EXPERIENCE_LEVELS = ['student', 'intermediate', 'advanced'] as const
export const CASHFLOW_TOLERANCES = ['tight', 'medium', 'flexible'] as const

export const OnboardingSchema = z.object({
  experience_level: z.enum(EXPERIENCE_LEVELS).optional(),
  cashflow_tolerance: z.enum(CASHFLOW_TOLERANCES).optional(),
  primary_channels: z.array(z.enum(TRAFFIC_CHANNELS)).default([]),
  budget_min_usd: z.coerce.number().int().min(0).optional(),
  budget_max_usd: z.coerce.number().int().min(0).optional(),
  preferred_vertical_id: z.string().uuid().optional().or(z.literal('')),
})

export type OnboardingInput = z.infer<typeof OnboardingSchema>
