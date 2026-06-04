import { NextResponse } from 'next/server'
import type Stripe from 'stripe'

import { createAdminClient } from '@/lib/supabase/admin'
import { applyStripeEffects } from '@/lib/stripe/applyEffects'
import { getStripe } from '@/lib/stripe/client'
import { planStripeEffects } from '@/lib/stripe/planEffects'
import { PRO_PLAN } from '@/lib/stripe/products'

// Raw body + signature verification require the Node runtime.
export const runtime = 'nodejs'

export async function POST(req: Request) {
  const stripe = getStripe()
  const secret = process.env.STRIPE_WEBHOOK_SECRET
  if (!stripe || !secret) {
    return NextResponse.json({ error: 'Billing not configured' }, { status: 503 })
  }

  const sig = req.headers.get('stripe-signature')
  if (!sig) return NextResponse.json({ error: 'Missing signature' }, { status: 400 })

  const body = await req.text()
  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig, secret)
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Idempotency: first insert wins; a duplicate delivery hits the unique pk.
  const { error: dupErr } = await admin
    .from('stripe_events')
    .insert({ event_id: event.id, type: event.type })
  if (dupErr) return NextResponse.json({ received: true, duplicate: true })

  try {
    await applyStripeEffects(
      planStripeEffects(event as unknown as { type: string; data: { object: Record<string, unknown> } })
    )

    // Subscription renewals: grant the period's credits. The first invoice
    // (billing_reason 'subscription_create') is already covered by the initial
    // checkout grant, so only 'subscription_cycle' renewals grant here.
    if (event.type === 'invoice.paid' || event.type === 'invoice.payment_succeeded') {
      const inv = event.data.object as Stripe.Invoice & { billing_reason?: string }
      const customerId = typeof inv.customer === 'string' ? inv.customer : inv.customer?.id
      if (inv.billing_reason === 'subscription_cycle' && customerId) {
        const { data: cust } = await admin
          .from('stripe_customers')
          .select('workspace_id')
          .eq('stripe_customer_id', customerId)
          .maybeSingle()
        if (cust?.workspace_id) {
          await admin.from('credit_ledger').insert({
            workspace_id: cust.workspace_id,
            entry_type: 'purchased',
            amount: PRO_PLAN.credits_per_period,
            reason: 'Subscription renewal credits',
          })
        }
      }
    }
  } catch {
    return NextResponse.json({ error: 'Handler error' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}
