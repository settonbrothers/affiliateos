// Deno copy of src/types/agents/envelope.ts. See decisions/003.
// KEEP IN SYNC with the Node-side copy.
import { z } from 'npm:zod@^3.24.0'

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
