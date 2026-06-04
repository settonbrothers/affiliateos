// Pure mapping from a Stripe event to the DB effects it should cause. Kept
// side-effect-free (no DB, no Stripe SDK) so the credit/subscription logic is
// unit-testable without keys. The webhook route applies these via applyEffects,
// and handles invoice.paid renewals separately (they need a customer lookup).

export type StripeEffects = {
  grantCredits?: { workspaceId: string; credits: number; reason: string }
  recordCustomer?: { workspaceId: string; customerId: string }
  upsertSubscription?: {
    workspaceId: string
    stripeSubscriptionId: string
    status: string
    currentPeriodEnd: string | null
    plan: string
  }
}

type MinimalEvent = {
  type: string
  data: { object: Record<string, unknown> }
}

function str(v: unknown): string | undefined {
  return typeof v === 'string' ? v : undefined
}

export function planStripeEffects(event: MinimalEvent): StripeEffects {
  const obj = event.data.object
  const meta = (obj.metadata as Record<string, string> | undefined) ?? {}
  const effects: StripeEffects = {}

  switch (event.type) {
    case 'checkout.session.completed': {
      const workspaceId = meta.workspace_id
      const credits = Number(meta.credits ?? 0)
      if (workspaceId && credits > 0) {
        effects.grantCredits = {
          workspaceId,
          credits,
          reason:
            obj.mode === 'subscription'
              ? 'Subscription credits'
              : `Purchased ${credits} credits`,
        }
      }
      const customerId = str(obj.customer)
      if (workspaceId && customerId) {
        effects.recordCustomer = { workspaceId, customerId }
      }
      break
    }
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted': {
      const workspaceId = meta.workspace_id
      if (workspaceId) {
        const periodEnd = obj.current_period_end
        effects.upsertSubscription = {
          workspaceId,
          stripeSubscriptionId: String(obj.id),
          status:
            event.type === 'customer.subscription.deleted'
              ? 'canceled'
              : String(obj.status ?? 'active'),
          currentPeriodEnd:
            typeof periodEnd === 'number'
              ? new Date(periodEnd * 1000).toISOString()
              : null,
          plan: 'pro',
        }
      }
      break
    }
  }

  return effects
}
