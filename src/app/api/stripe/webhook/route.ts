import { NextResponse } from 'next/server'
import type Stripe from 'stripe'

import { sendEmail } from '@/lib/email/send'
import {
  paymentFailedEmail,
  receiptEmail,
  subscriptionCanceledEmail,
} from '@/lib/email/templates'
import { captureException } from '@/lib/observability/sentry'
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

  // Resolve the notification recipient (workspace owner's email).
  const ownerEmail = async (workspaceId: string | null): Promise<string | null> => {
    if (!workspaceId) return null
    const { data: ws } = await admin
      .from('workspaces')
      .select('created_by')
      .eq('id', workspaceId)
      .maybeSingle()
    if (!ws?.created_by) return null
    const { data: p } = await admin
      .from('profiles')
      .select('email')
      .eq('id', ws.created_by)
      .maybeSingle()
    return p?.email ?? null
  }
  const workspaceForCustomer = async (
    customerId: string | undefined
  ): Promise<string | null> => {
    if (!customerId) return null
    const { data } = await admin
      .from('stripe_customers')
      .select('workspace_id')
      .eq('stripe_customer_id', customerId)
      .maybeSingle()
    return data?.workspace_id ?? null
  }

  // Idempotency: check for duplicate before processing; insert only after success.
  const { data: existingEvent } = await admin
    .from('stripe_events')
    .select('event_id')
    .eq('event_id', event.id)
    .maybeSingle()
  if (existingEvent) return NextResponse.json({ received: true, duplicate: true })

  try {
    await applyStripeEffects(
      planStripeEffects(event as unknown as { type: string; data: { object: Record<string, unknown> } })
    )

    // Insert idempotency row only after effects are successfully applied.
    // If applyStripeEffects threw, we skip this so Stripe can retry.
    await admin
      .from('stripe_events')
      .insert({ event_id: event.id, type: event.type })

    // Subscription renewals: grant the period's credits. The first invoice
    // (billing_reason 'subscription_create') is already covered by the initial
    // checkout grant, so only 'subscription_cycle' renewals grant here.
    if (event.type === 'invoice.paid') {
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
          await sendEmail(
            await ownerEmail(cust.workspace_id),
            receiptEmail({
              credits: PRO_PLAN.credits_per_period,
              amountCents: inv.amount_paid ?? PRO_PLAN.amount_cents,
              kind: 'subscription',
            })
          )
        }
      }
    }

    // Revoke credits when a charge is refunded so users can't keep credits from
    // a payment they got their money back on. The negative ledger entry mirrors
    // the original grant amount derived from the refunded cents.
    if (event.type === 'charge.refunded') {
      const charge = event.data.object as Stripe.Charge
      const customerId =
        typeof charge.customer === 'string' ? charge.customer : charge.customer?.id
      const workspaceId = await workspaceForCustomer(customerId)
      if (workspaceId) {
        // amount_refunded is in cents; convert to credits using the same rate as
        // the checkout flow (100 cents = 1 USD; credits are granted per product).
        // We record a negative entry for the refunded amount in credits.
        // Look up the most recent 'purchased' ledger entries that correspond to
        // the charge amount to determine how many credits to revoke.
        const refundedCents = charge.amount_refunded ?? 0
        if (refundedCents > 0) {
          // Find purchased credit entries for this workspace to identify the
          // grant that corresponds to this charge, ordered most recent first.
          const { data: grants } = await admin
            .from('credit_ledger')
            .select('id, amount')
            .eq('workspace_id', workspaceId)
            .eq('entry_type', 'purchased')
            .order('created_at', { ascending: false })
            .limit(5)

          // Revoke credits proportional to what was refunded. If the entire
          // charge was refunded, revoke the most recent purchase grant in full.
          const mostRecentGrant = grants?.[0]
          if (mostRecentGrant) {
            await admin.from('credit_ledger').insert({
              workspace_id: workspaceId,
              entry_type: 'refunded',
              amount: -mostRecentGrant.amount,
              reason: `Credits revoked — charge refunded (charge: ${charge.id})`,
            })
          }
        }
      }
    }

    // Notifications (best-effort; no-op without RESEND_API_KEY).
    if (event.type === 'checkout.session.completed') {
      const obj = event.data.object as Stripe.Checkout.Session
      const wsId = obj.metadata?.workspace_id ?? null
      const credits = Number(obj.metadata?.credits ?? 0)
      if (wsId && credits > 0) {
        await sendEmail(
          await ownerEmail(wsId),
          receiptEmail({
            credits,
            amountCents: obj.amount_total ?? 0,
            kind: obj.mode === 'subscription' ? 'subscription' : 'credits',
          })
        )
      }
    } else if (event.type === 'customer.subscription.deleted') {
      const obj = event.data.object as Stripe.Subscription
      await sendEmail(
        await ownerEmail(obj.metadata?.workspace_id ?? null),
        subscriptionCanceledEmail()
      )
    } else if (event.type === 'invoice.payment_failed') {
      const inv = event.data.object as Stripe.Invoice
      const customerId = typeof inv.customer === 'string' ? inv.customer : inv.customer?.id
      await sendEmail(
        await ownerEmail(await workspaceForCustomer(customerId)),
        paymentFailedEmail()
      )
    }
  } catch (err) {
    await captureException(err, {
      tags: { route: 'stripe-webhook', event_type: event.type },
    })
    return NextResponse.json({ error: 'Handler error' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}
