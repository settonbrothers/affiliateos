import { z } from 'npm:zod@^3.24.0'

export const CurrencyCodeSchema = z.string().regex(/^[A-Z]{3}$/)

export const EconomicsSourceSchema = z.object({
  source_id: z.string().min(1),
  field: z.string().min(1),
  verified: z.boolean(),
  confidence: z.number().int().min(0).max(100),
  as_of: z.string().datetime().nullable(),
})

export const OfferEconomicsV1Schema = z.object({
  schema_version: z.literal('offer-economics-v1'),
  internal_only: z.literal(true),
  commission_model: z.enum([
    'fixed_per_conversion',
    'revenue_share',
    'recurring',
    'hybrid',
    'unknown',
  ]),
  commission_event: z.enum([
    'raw_conversion',
    'approved_conversion',
    'sale',
    'unknown',
  ]),
  payout_currency: CurrencyCodeSchema.nullable(),
  fixed_payout_per_event: z.number().min(0).nullable(),
  revenue_share_rate: z.number().min(0).max(1).nullable(),
  average_order_value: z.number().min(0).nullable(),
  approval_rate: z.number().min(0).max(1).nullable(),
  reversal_rate: z.number().min(0).max(1).nullable(),
  variable_fee_per_approved_conversion: z.number().min(0).nullable(),
  recurring_value: z.object({
    amount_per_period: z.number().min(0).nullable(),
    period: z.enum(['month', 'year', 'unknown']),
    validated_retention_periods: z.number().min(0).nullable(),
  }),
  payout_delay_days: z.number().int().min(0).nullable(),
  network_epc: z.object({
    amount: z.number().min(0).nullable(),
    currency: CurrencyCodeSchema.nullable(),
    basis: z.enum(['network_reported', 'measured_campaign', 'unknown']),
  }),
  fx_to_reporting_currency: z.object({
    reporting_currency: CurrencyCodeSchema.nullable(),
    rate: z.number().positive().nullable(),
    source: z.string().nullable(),
    captured_at: z.string().datetime().nullable(),
  }),
  sources: z.array(EconomicsSourceSchema),
  missing_inputs: z.array(z.string()),
})

const NullableMetricSchema = z.number().nullable()
export const CampaignEconomicsAssessmentSchema = z.object({
  reporting_currency: CurrencyCodeSchema,
  metrics: z.object({
    ctr: NullableMetricSchema,
    cpc: NullableMetricSchema,
    landing_view_rate: NullableMetricSchema,
    affiliate_click_rate: NullableMetricSchema,
    raw_cvr_from_ad_click: NullableMetricSchema,
    approved_cvr_from_ad_click: NullableMetricSchema,
    cpa_raw: NullableMetricSchema,
    cpa_approved: NullableMetricSchema,
    epc_ad_click: NullableMetricSchema,
    epc_affiliate_click: NullableMetricSchema,
    roas: NullableMetricSchema,
    profit: NullableMetricSchema,
    profit_margin: NullableMetricSchema,
  }),
  planning: z.object({
    net_value_per_approved_conversion: NullableMetricSchema,
    net_value_per_raw_conversion: NullableMetricSchema,
    break_even_cpa: NullableMetricSchema,
    break_even_cpc: NullableMetricSchema,
    required_click_to_approved_cvr: NullableMetricSchema,
    scale_headroom_ratio: NullableMetricSchema,
  }),
  revenue_basis: z.enum(['measured', 'economics_estimate', 'unknown']),
  data_sufficiency: z.enum(['thin', 'directional', 'decision_ready']),
  primary_economic_read: z.enum([
    'profitable',
    'unprofitable',
    'implausible',
    'unknown',
  ]),
  flags: z.array(
    z.enum([
      'economics_missing',
      'fx_missing',
      'sample_too_small',
      'approved_data_missing',
      'recurring_retention_unvalidated',
      'economically_implausible_at_current_cpc',
      'unprofitable',
      'profitable',
      'scale_headroom',
    ])
  ),
})

export type OfferEconomicsV1 = z.infer<typeof OfferEconomicsV1Schema>
export type CampaignEconomicsAssessment = z.infer<
  typeof CampaignEconomicsAssessmentSchema
>
