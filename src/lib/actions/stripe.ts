'use server'

import { headers } from 'next/headers'

import { getCurrentWorkspaceId } from '@/lib/queries/credits'
import { createAdminClient } from '@/lib/supabase/admin'
import { getStripe } from '@/lib/stripe/client'
import { CREDIT_PACK, PRO_PLAN } from '@/lib/stripe/products'
import { createClient } from '@/lib/supabase/server'

type SessionResult = { url: string } | { error: string }

async function origin(): Promise<string> {
  const h = await headers()
  return h.get('origin') ?? process.env.NEXT_PUBLIC_SITE_URL ?? ''
}

// Resolve (or lazily create) the workspace's Stripe customer.
async function ensureCustomer(
  workspaceId: string,
  email: string | undefined
): Promise<string> {
  const stripe = getStripe()!
  const admin = createAdminClient()
  const { data } = await admin
    .from('stripe_customers')
    .select('stripe_customer_id')
    .eq('workspace_id', workspaceId)
    .maybeSingle()
  if (data?.stripe_customer_id) return data.stripe_customer_id

  const customer = await stripe.customers.create(
    {
      email,
      metadata: { workspace_id: workspaceId },
    },
    { idempotencyKey: `customer-${workspaceId}` }
  )
  await admin
    .from('stripe_customers')
    .upsert(
      { workspace_id: workspaceId, stripe_customer_id: customer.id },
      { onConflict: 'workspace_id' }
    )
  return customer.id
}

export async function createCheckoutSession(
  kind: 'subscription' | 'credits'
): Promise<SessionResult> {
  const stripe = getStripe()
  if (!stripe) return { error: 'Billing is not configured yet.' }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated.' }

  const workspaceId = await getCurrentWorkspaceId()
  if (!workspaceId) return { error: 'No workspace.' }

  const customerId = await ensureCustomer(workspaceId, user.email ?? undefined)
  const base = await origin()
  const success_url = `${base}/billing?status=success`
  const cancel_url = `${base}/billing?status=cancel`

  if (kind === 'credits') {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer: customerId,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: 'usd',
            unit_amount: CREDIT_PACK.amount_cents,
            product_data: { name: CREDIT_PACK.name },
          },
        },
      ],
      metadata: { workspace_id: workspaceId, credits: String(CREDIT_PACK.credits) },
      success_url,
      cancel_url,
    })
    return session.url ? { url: session.url } : { error: 'Could not start checkout.' }
  }

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: 'usd',
          unit_amount: PRO_PLAN.amount_cents,
          recurring: { interval: PRO_PLAN.interval },
          product_data: { name: PRO_PLAN.name },
        },
      },
    ],
    metadata: {
      workspace_id: workspaceId,
      credits: String(PRO_PLAN.credits_per_period),
    },
    subscription_data: { metadata: { workspace_id: workspaceId } },
    success_url,
    cancel_url,
  })
  return session.url ? { url: session.url } : { error: 'Could not start checkout.' }
}

export async function createPortalSession(): Promise<SessionResult> {
  const stripe = getStripe()
  if (!stripe) return { error: 'Billing is not configured yet.' }

  const workspaceId = await getCurrentWorkspaceId()
  if (!workspaceId) return { error: 'No workspace.' }

  const admin = createAdminClient()
  const { data } = await admin
    .from('stripe_customers')
    .select('stripe_customer_id')
    .eq('workspace_id', workspaceId)
    .maybeSingle()
  if (!data?.stripe_customer_id) {
    return { error: 'No billing account yet — subscribe or buy credits first.' }
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: data.stripe_customer_id,
    return_url: `${await origin()}/billing`,
  })
  return { url: session.url }
}
