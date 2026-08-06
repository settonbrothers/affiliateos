// Node copy. KEEP IN SYNC with supabase/functions/_shared/types/discoverNetwork.ts.
import { z } from 'zod'

export const AFFILIATE_NETWORKS = [
  'MaxBounty',
  'Clickbank',
  'CJ',
  'ShareASale',
  'Impact',
  'Other',
] as const

export const NetworkComparisonSchema = z.object({
  networks_found: z.array(
    z.object({
      network_name: z.enum(AFFILIATE_NETWORKS),
      estimated_epc_usd: z.number().optional(),
      estimated_commission_type: z
        .enum(['CPA', 'RevShare', 'Hybrid', 'CPS'])
        .optional(),
      confidence: z.enum(['high', 'medium', 'low']),
    })
  ),
  recommended_network: z.string().optional(),
  recommended_reason: z.string().optional(),
  trending_signal: z.enum(['rising', 'stable', 'declining']).optional(),
  trending_evidence: z.string().optional(),
})

export type NetworkComparison = z.infer<typeof NetworkComparisonSchema>

/** offers.trending_score, derived from the signal (migration 0039). */
export function trendingScore(
  signal: NetworkComparison['trending_signal'] | null
): number {
  if (signal === 'rising') return 2
  if (signal === 'stable') return 1
  if (signal === 'declining') return -1
  return 0
}
