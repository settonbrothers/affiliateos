import { describe, expect, it } from 'vitest'

import { planStripeEffects } from './planEffects'

describe('planStripeEffects', () => {
  it('grants pack credits on a one-time checkout', () => {
    const e = planStripeEffects({
      type: 'checkout.session.completed',
      data: {
        object: {
          mode: 'payment',
          customer: 'cus_1',
          metadata: { workspace_id: 'ws_1', credits: '30' },
        },
      },
    })
    expect(e.grantCredits).toEqual({
      workspaceId: 'ws_1',
      credits: 30,
      reason: 'Purchased 30 credits',
    })
    expect(e.recordCustomer).toEqual({ workspaceId: 'ws_1', customerId: 'cus_1' })
  })

  it('grants subscription credits with the right reason', () => {
    const e = planStripeEffects({
      type: 'checkout.session.completed',
      data: {
        object: {
          mode: 'subscription',
          customer: 'cus_2',
          metadata: { workspace_id: 'ws_2', credits: '50' },
        },
      },
    })
    expect(e.grantCredits?.credits).toBe(50)
    expect(e.grantCredits?.reason).toBe('Subscription credits')
  })

  it('does not grant when metadata is missing', () => {
    const e = planStripeEffects({
      type: 'checkout.session.completed',
      data: { object: { mode: 'payment', metadata: {} } },
    })
    expect(e.grantCredits).toBeUndefined()
  })

  it('upserts subscription status + period on update', () => {
    const e = planStripeEffects({
      type: 'customer.subscription.updated',
      data: {
        object: {
          id: 'sub_1',
          status: 'active',
          current_period_end: 1781000000,
          metadata: { workspace_id: 'ws_3' },
        },
      },
    })
    expect(e.upsertSubscription?.stripeSubscriptionId).toBe('sub_1')
    expect(e.upsertSubscription?.status).toBe('active')
    expect(e.upsertSubscription?.currentPeriodEnd).toBe(
      new Date(1781000000 * 1000).toISOString()
    )
  })

  it('marks canceled on subscription.deleted', () => {
    const e = planStripeEffects({
      type: 'customer.subscription.deleted',
      data: { object: { id: 'sub_1', status: 'active', metadata: { workspace_id: 'ws_3' } } },
    })
    expect(e.upsertSubscription?.status).toBe('canceled')
  })
})
