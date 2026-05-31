// Deno-side Zod schema for SourceExtractionOrchestrator. See decisions/003.
// Enum values mirror migrations 0010_source_documents.sql (source_doc_type)
// and 0011_extracted_facts.sql (fact_type) — KEEP IN SYNC if those enums change.
import { z } from 'npm:zod@^3.24.0'

import { UniversalEnvelopeSchema } from './envelope.ts'

export const FACT_TYPES = [
  'commission_value',
  'commission_type',
  'payout_delay',
  'cookie_duration',
  'traffic_rule_paid_social',
  'traffic_rule_google',
  'traffic_rule_native',
  'traffic_rule_youtube',
  'traffic_rule_brand_bidding',
  'traffic_rule_direct_link',
  'traffic_rule_email',
  'traffic_rule_seo',
  'traffic_rule_organic_social',
  'allowed_geo',
  'restricted_geo',
  'cap',
  'refund_policy',
  'compliance_claim',
  'pricing_aov',
  'minimum_payout',
  'contact',
  'other',
] as const

export const DOC_TYPES = [
  'product_page',
  'pricing_page',
  'affiliate_terms',
  'checkout_page',
  'review_page',
  'ad_example',
  'landing_page',
  'manual_note',
  'unknown',
] as const

export const ExtractedFactSchema = z.object({
  fact_type: z.enum(FACT_TYPES),
  fact_value: z.string(),
  source_quote: z.string(),
  confidence_score: z.number().int().min(0).max(100),
})

export const DetectedClaimSchema = z.object({
  claim_text: z.string(),
  claim_type: z.string(),
})

export const SourceExtractionPayloadSchema = z.object({
  doc_type: z.enum(DOC_TYPES),
  source_summary: z.string(),
  language: z.string(),
  source_reliability_score: z.number().int().min(0).max(100),
  facts: z.array(ExtractedFactSchema).max(30),
  detected_claims: z.array(DetectedClaimSchema),
})

export const SourceExtractionResponseSchema = UniversalEnvelopeSchema.extend({
  payload: SourceExtractionPayloadSchema,
})

export type SourceExtractionResponse = z.infer<typeof SourceExtractionResponseSchema>
