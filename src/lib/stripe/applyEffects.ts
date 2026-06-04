import 'server-only'

import { createAdminClient } from '@/lib/supabase/admin'

import type { StripeEffects } from './planEffects'

// Apply the planned effects to the DB (service role). Credit grants land in
// credit_ledger as 'purchased'; customer/subscription rows are upserted.
export async function applyStripeEffects(effects: StripeEffects): Promise<void> {
  const admin = createAdminClient()

  if (effects.grantCredits) {
    await admin.from('credit_ledger').insert({
      workspace_id: effects.grantCredits.workspaceId,
      entry_type: 'purchased',
      amount: effects.grantCredits.credits,
      reason: effects.grantCredits.reason,
    })
  }

  if (effects.recordCustomer) {
    await admin.from('stripe_customers').upsert(
      {
        workspace_id: effects.recordCustomer.workspaceId,
        stripe_customer_id: effects.recordCustomer.customerId,
      },
      { onConflict: 'workspace_id' }
    )
  }

  if (effects.upsertSubscription) {
    const s = effects.upsertSubscription
    await admin.from('subscriptions').upsert(
      {
        workspace_id: s.workspaceId,
        stripe_subscription_id: s.stripeSubscriptionId,
        status: s.status,
        current_period_end: s.currentPeriodEnd,
        plan: s.plan,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'stripe_subscription_id' }
    )
  }
}
