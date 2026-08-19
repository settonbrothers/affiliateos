export type CommissionModel =
  'fixed_per_conversion' | 'revenue_share' | 'recurring' | 'hybrid' | 'unknown'

export type EconomicsInput = {
  commission_model: CommissionModel
  commission_event:
    'raw_conversion' | 'approved_conversion' | 'sale' | 'unknown'
  payout_currency: string | null
  fixed_payout_per_event: number | null
  revenue_share_rate: number | null
  average_order_value: number | null
  approval_rate: number | null
  reversal_rate: number | null
  variable_fee_per_approved_conversion: number | null
  recurring_value: {
    amount_per_period: number | null
    validated_retention_periods: number | null
  }
  fx_to_reporting_currency: {
    reporting_currency: string | null
    rate: number | null
  }
}

export type CampaignFunnelInput = {
  reporting_currency: string
  spend_amount: number
  impressions: number
  ad_clicks: number
  landing_views: number
  affiliate_clicks: number
  raw_conversions: number
  approved_conversions: number
  reversed_conversions: number
  commission_amount: number | null
  commission_currency: string | null
  plausible_max_click_to_approved_cvr?: number
}

export type EconomicsFlag =
  | 'economics_missing'
  | 'fx_missing'
  | 'sample_too_small'
  | 'approved_data_missing'
  | 'recurring_retention_unvalidated'
  | 'economically_implausible_at_current_cpc'
  | 'unprofitable'
  | 'profitable'
  | 'scale_headroom'

export type CampaignEconomicsAssessment = {
  reporting_currency: string
  metrics: {
    ctr: number | null
    cpc: number | null
    landing_view_rate: number | null
    affiliate_click_rate: number | null
    raw_cvr_from_ad_click: number | null
    approved_cvr_from_ad_click: number | null
    cpa_raw: number | null
    cpa_approved: number | null
    epc_ad_click: number | null
    epc_affiliate_click: number | null
    roas: number | null
    profit: number | null
    profit_margin: number | null
  }
  planning: {
    net_value_per_approved_conversion: number | null
    net_value_per_raw_conversion: number | null
    break_even_cpa: number | null
    break_even_cpc: number | null
    required_click_to_approved_cvr: number | null
    scale_headroom_ratio: number | null
  }
  revenue_basis: 'measured' | 'economics_estimate' | 'unknown'
  data_sufficiency: 'thin' | 'directional' | 'decision_ready'
  primary_economic_read:
    'profitable' | 'unprofitable' | 'implausible' | 'unknown'
  flags: EconomicsFlag[]
}

const ratio = (numerator: number, denominator: number) =>
  denominator > 0 ? numerator / denominator : null
const round = (value: number | null, digits = 4) =>
  value === null ? null : Number(value.toFixed(digits))

function convertPayout(
  value: number,
  payoutCurrency: string | null,
  reportingCurrency: string,
  fx: EconomicsInput['fx_to_reporting_currency']
): number | null {
  if (!payoutCurrency) return null
  if (payoutCurrency === reportingCurrency) return value
  if (fx.reporting_currency !== reportingCurrency || !fx.rate) return null
  return value * fx.rate
}

function approvedValue(
  economics: EconomicsInput,
  reportingCurrency: string
): {
  approved: number | null
  raw: number | null
  recurringUnvalidated: boolean
} {
  const fixed = economics.fixed_payout_per_event ?? 0
  const share =
    economics.revenue_share_rate !== null &&
    economics.average_order_value !== null
      ? economics.revenue_share_rate * economics.average_order_value
      : 0
  let gross: number | null = null
  let recurringUnvalidated = false

  if (economics.commission_model === 'fixed_per_conversion')
    gross = fixed || null
  if (economics.commission_model === 'revenue_share') gross = share || null
  if (economics.commission_model === 'hybrid') gross = fixed + share || null
  if (economics.commission_model === 'recurring') {
    const recurring = economics.recurring_value
    if (
      recurring.amount_per_period !== null &&
      recurring.validated_retention_periods !== null
    ) {
      gross =
        recurring.amount_per_period * recurring.validated_retention_periods
    } else {
      recurringUnvalidated = true
    }
  }
  if (gross === null) return { approved: null, raw: null, recurringUnvalidated }

  const converted = convertPayout(
    gross,
    economics.payout_currency,
    reportingCurrency,
    economics.fx_to_reporting_currency
  )
  if (converted === null)
    return { approved: null, raw: null, recurringUnvalidated }
  const reversalMultiplier = 1 - (economics.reversal_rate ?? 0)
  const fee = economics.variable_fee_per_approved_conversion ?? 0
  const approved = Math.max(0, converted * reversalMultiplier - fee)
  const raw =
    economics.commission_event === 'approved_conversion'
      ? economics.approval_rate === null
        ? null
        : approved * economics.approval_rate
      : approved
  return { approved, raw, recurringUnvalidated }
}

export function calculateCampaignEconomics(
  economics: EconomicsInput | null,
  funnel: CampaignFunnelInput
): CampaignEconomicsAssessment {
  const flags: EconomicsFlag[] = []
  const dataSufficiency =
    funnel.ad_clicks >= 100 && funnel.approved_conversions >= 5
      ? 'decision_ready'
      : funnel.ad_clicks >= 20
        ? 'directional'
        : 'thin'
  if (dataSufficiency === 'thin') flags.push('sample_too_small')

  const cpc = ratio(funnel.spend_amount, funnel.ad_clicks)
  const cpaRaw = ratio(funnel.spend_amount, funnel.raw_conversions)
  const cpaApproved = ratio(funnel.spend_amount, funnel.approved_conversions)
  if (funnel.raw_conversions > 0 && funnel.approved_conversions === 0)
    flags.push('approved_data_missing')

  const values = economics
    ? approvedValue(economics, funnel.reporting_currency)
    : { approved: null, raw: null, recurringUnvalidated: false }
  if (!economics || values.approved === null) flags.push('economics_missing')
  if (
    economics &&
    economics.payout_currency !== null &&
    economics.payout_currency !== funnel.reporting_currency &&
    values.approved === null
  )
    flags.push('fx_missing')
  if (values.recurringUnvalidated) flags.push('recurring_retention_unvalidated')

  let measuredRevenue: number | null = null
  if (
    funnel.commission_amount !== null &&
    funnel.commission_currency !== null
  ) {
    measuredRevenue = economics
      ? convertPayout(
          funnel.commission_amount,
          funnel.commission_currency,
          funnel.reporting_currency,
          economics.fx_to_reporting_currency
        )
      : funnel.commission_currency === funnel.reporting_currency
        ? funnel.commission_amount
        : null
  }
  const estimatedRevenue =
    values.approved !== null && funnel.approved_conversions > 0
      ? values.approved *
        Math.max(0, funnel.approved_conversions - funnel.reversed_conversions)
      : values.raw !== null && funnel.raw_conversions > 0
        ? values.raw * funnel.raw_conversions
        : null
  const revenue = measuredRevenue ?? estimatedRevenue
  const revenueBasis =
    measuredRevenue !== null
      ? 'measured'
      : estimatedRevenue !== null
        ? 'economics_estimate'
        : 'unknown'
  const profit = revenue === null ? null : revenue - funnel.spend_amount
  const roas = revenue === null ? null : ratio(revenue, funnel.spend_amount)
  const approvedCvr = ratio(funnel.approved_conversions, funnel.ad_clicks)
  const breakEvenCpc =
    values.approved !== null && approvedCvr !== null
      ? values.approved * approvedCvr
      : null
  const requiredCvr =
    cpc !== null && values.approved !== null && values.approved > 0
      ? cpc / values.approved
      : null
  const plausibleMax = funnel.plausible_max_click_to_approved_cvr ?? 0.25
  const implausible =
    dataSufficiency !== 'thin' &&
    requiredCvr !== null &&
    requiredCvr > plausibleMax
  if (implausible) flags.push('economically_implausible_at_current_cpc')
  if (profit !== null && profit < 0) flags.push('unprofitable')
  if (profit !== null && profit > 0) flags.push('profitable')
  const headroom =
    cpaApproved !== null && values.approved !== null && values.approved > 0
      ? 1 - cpaApproved / values.approved
      : null
  if (
    dataSufficiency === 'decision_ready' &&
    headroom !== null &&
    headroom >= 0.2
  )
    flags.push('scale_headroom')

  return {
    reporting_currency: funnel.reporting_currency,
    metrics: {
      ctr: round(ratio(funnel.ad_clicks, funnel.impressions)),
      cpc: round(cpc),
      landing_view_rate: round(ratio(funnel.landing_views, funnel.ad_clicks)),
      affiliate_click_rate: round(
        ratio(funnel.affiliate_clicks, funnel.landing_views)
      ),
      raw_cvr_from_ad_click: round(
        ratio(funnel.raw_conversions, funnel.ad_clicks)
      ),
      approved_cvr_from_ad_click: round(approvedCvr),
      cpa_raw: round(cpaRaw),
      cpa_approved: round(cpaApproved),
      epc_ad_click: round(
        revenue === null ? null : ratio(revenue, funnel.ad_clicks)
      ),
      epc_affiliate_click: round(
        revenue === null ? null : ratio(revenue, funnel.affiliate_clicks)
      ),
      roas: round(roas),
      profit: round(profit, 2),
      profit_margin: round(
        profit === null || revenue === null ? null : ratio(profit, revenue)
      ),
    },
    planning: {
      net_value_per_approved_conversion: round(values.approved, 2),
      net_value_per_raw_conversion: round(values.raw, 2),
      break_even_cpa: round(values.approved, 2),
      break_even_cpc: round(breakEvenCpc, 2),
      required_click_to_approved_cvr: round(requiredCvr),
      scale_headroom_ratio: round(headroom),
    },
    revenue_basis: revenueBasis,
    data_sufficiency: dataSufficiency,
    primary_economic_read: implausible
      ? 'implausible'
      : profit === null
        ? 'unknown'
        : profit > 0
          ? 'profitable'
          : 'unprofitable',
    flags: [...new Set(flags)],
  }
}
