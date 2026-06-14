import { z } from 'zod'

// Breadth maps to how aggressively the scan fans out (queries × results).
// Resolved to concrete numbers in the edge fn (BREADTH_PARAMS).
export const SCAN_BREADTHS = ['quick', 'standard', 'deep'] as const

export const StartScanSchema = z.object({
  vertical_id: z.string().uuid('Select a vertical.'),
  breadth: z.enum(SCAN_BREADTHS).default('standard'),
})
export type StartScanInput = z.infer<typeof StartScanSchema>

export const DISCOVERY_SOURCE_KINDS = [
  'web_search',
  'directory',
  'network',
] as const

export const DiscoverySourceSchema = z.object({
  name: z.string().min(2, 'Name is required.'),
  kind: z.enum(DISCOVERY_SOURCE_KINDS).default('web_search'),
  vertical_id: z.string().uuid().optional().or(z.literal('')),
  query_templates: z.array(z.string().min(1)).optional(),
  enabled: z.boolean().default(true),
})
export type DiscoverySourceInput = z.infer<typeof DiscoverySourceSchema>
