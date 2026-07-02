import { z } from 'npm:zod@^3.24.0'

export const AFFILIATE_NETWORKS = ['MaxBounty', 'Clickbank', 'CJ', 'ShareASale', 'Impact', 'Other'] as const

export const NetworkComparisonSchema = z.object({
  networks_found: z.array(z.object({
    network_name: z.enum(AFFILIATE_NETWORKS),
    estimated_epc_usd: z.number().optional(),
    estimated_commission_type: z.enum(['CPA', 'RevShare', 'Hybrid', 'CPS']).optional(),
    confidence: z.enum(['high', 'medium', 'low']),
  })),
  recommended_network: z.string().optional(),
  recommended_reason: z.string().optional(),
  trending_signal: z.enum(['rising', 'stable', 'declining']).optional(),
  trending_evidence: z.string().optional(),
})

export type NetworkComparison = z.infer<typeof NetworkComparisonSchema>
