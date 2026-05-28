import { z } from 'zod'

// Universal Envelope — every orchestrator returns this top-level structure.
// Source of truth for the contract; see decisions/002.
export const UniversalEnvelopeSchema = z.object({
  orchestrator_name: z.string(),
  agent_version: z.string(),
  status: z.enum(['success', 'partial', 'failed']),
  confidence_score: z.number().int().min(0).max(100),
  facts: z.array(
    z.object({
      statement: z.string(),
      source: z.string().nullable(),
      confidence: z.number().int().min(0).max(100),
    })
  ),
  assumptions: z.array(z.string()),
  estimates: z.array(
    z.object({
      metric: z.string(),
      value: z.string(),
      basis: z.string(),
    })
  ),
  risks: z.array(
    z.object({
      type: z.string(),
      description: z.string(),
      severity: z.enum(['low', 'medium', 'high', 'critical']),
    })
  ),
  unknowns: z.array(z.string()),
  missing_data: z.array(z.string()),
  human_review_required: z.boolean(),
  human_review_reasons: z.array(z.string()),
})

export type UniversalEnvelope = z.infer<typeof UniversalEnvelopeSchema>
