// MVP catalog (plan 03/05): one subscription + one one-time credit pack.
// Prices are created inline via Checkout price_data, so no pre-created Stripe
// price IDs are required — only the API keys.
export const PRO_PLAN = {
  name: 'AffiliateOS Pro',
  amount_cents: 5000, // $50
  interval: 'month' as const,
  credits_per_period: 50,
}

export const CREDIT_PACK = {
  name: '30 credit pack',
  amount_cents: 2000, // $20
  credits: 30,
}
