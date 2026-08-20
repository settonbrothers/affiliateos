import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

import {
  calculateCampaignEconomics,
  type CampaignFunnelInput,
  type EconomicsInput,
} from './campaignEconomics'

const fixed = (overrides: Partial<EconomicsInput> = {}): EconomicsInput => ({
  commission_model: 'fixed_per_conversion',
  commission_event: 'approved_conversion',
  payout_currency: 'ILS',
  fixed_payout_per_event: 30,
  revenue_share_rate: null,
  average_order_value: null,
  approval_rate: 1,
  reversal_rate: 0,
  variable_fee_per_approved_conversion: 0,
  recurring_value: {
    amount_per_period: null,
    validated_retention_periods: null,
  },
  fx_to_reporting_currency: {
    reporting_currency: 'ILS',
    rate: 1,
  },
  ...overrides,
})

const funnel = (
  overrides: Partial<CampaignFunnelInput> = {}
): CampaignFunnelInput => ({
  reporting_currency: 'ILS',
  spend_amount: 500,
  impressions: 10_000,
  ad_clicks: 100,
  landing_views: 90,
  affiliate_clicks: 60,
  raw_conversions: 10,
  approved_conversions: 10,
  reversed_conversions: 0,
  commission_amount: 300,
  commission_currency: 'ILS',
  ...overrides,
})

describe('calculateCampaignEconomics', () => {
  it('flags the ₪25 CPC / ₪30 payout example as economically implausible', () => {
    const out = calculateCampaignEconomics(
      fixed(),
      funnel({
        spend_amount: 500,
        ad_clicks: 20,
        approved_conversions: 1,
        raw_conversions: 1,
        commission_amount: 30,
      })
    )
    expect(out.metrics.cpc).toBe(25)
    expect(out.planning.required_click_to_approved_cvr).toBeCloseTo(0.8333, 4)
    expect(out.flags).toContain('economically_implausible_at_current_cpc')
    expect(out.primary_economic_read).toBe('implausible')
  })

  it('recognizes a profitable campaign below break-even CPA', () => {
    const out = calculateCampaignEconomics(
      fixed(),
      funnel({ spend_amount: 200, commission_amount: 300 })
    )
    expect(out.metrics.cpa_approved).toBe(20)
    expect(out.planning.break_even_cpa).toBe(30)
    expect(out.metrics.profit).toBe(100)
    expect(out.flags).toContain('profitable')
  })

  it('requires FX for different currencies', () => {
    const out = calculateCampaignEconomics(
      fixed({
        payout_currency: 'USD',
        fx_to_reporting_currency: { reporting_currency: null, rate: null },
      }),
      funnel({ commission_amount: null, commission_currency: null })
    )
    expect(out.flags).toContain('fx_missing')
    expect(out.primary_economic_read).toBe('unknown')
  })

  it('converts payout with a sourced reporting-currency rate', () => {
    const out = calculateCampaignEconomics(
      fixed({
        payout_currency: 'USD',
        fixed_payout_per_event: 10,
        fx_to_reporting_currency: { reporting_currency: 'ILS', rate: 3.7 },
      }),
      funnel({ commission_amount: null, commission_currency: null })
    )
    expect(out.planning.break_even_cpa).toBe(37)
  })

  it('does not value revenue share without an order value', () => {
    const out = calculateCampaignEconomics(
      fixed({
        commission_model: 'revenue_share',
        fixed_payout_per_event: null,
        revenue_share_rate: 0.3,
        average_order_value: null,
      }),
      funnel({ commission_amount: null, commission_currency: null })
    )
    expect(out.flags).toContain('economics_missing')
  })

  it('does not count recurring value without validated retention', () => {
    const out = calculateCampaignEconomics(
      fixed({
        commission_model: 'recurring',
        fixed_payout_per_event: null,
        recurring_value: {
          amount_per_period: 20,
          validated_retention_periods: null,
        },
      }),
      funnel({ commission_amount: null, commission_currency: null })
    )
    expect(out.flags).toContain('recurring_retention_unvalidated')
    expect(out.metrics.profit).toBeNull()
  })

  it('deducts reversals and variable fees from expected value', () => {
    const out = calculateCampaignEconomics(
      fixed({ reversal_rate: 0.1, variable_fee_per_approved_conversion: 2 }),
      funnel({ commission_amount: null, commission_currency: null })
    )
    expect(out.planning.net_value_per_approved_conversion).toBe(25)
  })

  it('marks small samples as thin instead of decision-ready', () => {
    const out = calculateCampaignEconomics(
      fixed(),
      funnel({
        ad_clicks: 3,
        approved_conversions: 0,
        raw_conversions: 0,
        commission_amount: 0,
      })
    )
    expect(out.data_sufficiency).toBe('thin')
    expect(out.flags).toContain('sample_too_small')
  })

  it('separates affiliate click rate from landing-view rate', () => {
    const out = calculateCampaignEconomics(fixed(), funnel())
    expect(out.metrics.landing_view_rate).toBe(0.9)
    expect(out.metrics.affiliate_click_rate).toBeCloseTo(0.6667, 4)
  })

  it('keeps Node and Deno calculators identical', () => {
    const node = readFileSync(
      resolve(process.cwd(), 'src/lib/campaignEconomics.ts'),
      'utf8'
    )
    const deno = readFileSync(
      resolve(process.cwd(), 'supabase/functions/_shared/campaignEconomics.ts'),
      'utf8'
    )
    expect(deno).toBe(node)
  })
})
