import 'server-only'

import Stripe from 'stripe'

// Env-guarded Stripe client. Returns null when STRIPE_SECRET_KEY is absent so
// the app degrades gracefully (billing simply "not configured") instead of
// crashing — same posture as middleware when Supabase env is missing.
let cached: Stripe | null = null

export function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) return null
  if (!cached) cached = new Stripe(key)
  return cached
}

export function isStripeConfigured(): boolean {
  return !!process.env.STRIPE_SECRET_KEY
}
