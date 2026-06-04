// Deno copy of src/types/agents/compliance.ts. See decisions/003 — KEEP IN
// SYNC with the Node-side copy.
import { z } from 'npm:zod@^3.24.0'

import { UniversalEnvelopeSchema } from './envelope.ts'

export const RISK_LEVELS = ['low', 'medium', 'high', 'critical'] as const

export const CLAIM_TYPES = [
  'medical_cure',
  'disease',
  'mental_health',
  'anxiety_depression',
  'weight_loss',
  'dental_health',
  'supplement',
  'before_after',
  'fake_proof',
  'scarcity',
  'income',
  'platform_policy',
  'geo_specific',
  'other',
] as const

const DetectedClaimSchema = z.object({
  claim_type: z.enum(CLAIM_TYPES),
  claim_text: z.string(),
  risk_level: z.enum(RISK_LEVELS),
  why_risky: z.string(),
  safe_framing: z.string(),
  forbidden_framing: z.string(),
  requires_disclaimer: z.boolean(),
})

export const CompliancePayloadSchema = z.object({
  overall_risk_level: z.enum(RISK_LEVELS),
  compliance_score: z.number().int().min(0).max(100),
  detected_claims: z.array(DetectedClaimSchema),
  platform_risks: z.array(z.string()),
  geo_risks: z.array(z.string()),
  tos_risks: z.array(z.string()),
  required_disclaimers: z.array(z.string()),
  paid_traffic_recommendation: z.enum([
    'allowed',
    'not_recommended',
    'blocked_until_review',
    'unknown',
  ]),
})

export const ComplianceResponseSchema = UniversalEnvelopeSchema.extend({
  payload: CompliancePayloadSchema,
})

export type ComplianceResponse = z.infer<typeof ComplianceResponseSchema>
export type CompliancePayload = z.infer<typeof CompliancePayloadSchema>
