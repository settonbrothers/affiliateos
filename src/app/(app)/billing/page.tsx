import { getTranslations } from 'next-intl/server'

import { BillingActions } from '@/components/billing/BillingActions'
import { GrantCreditsButton } from '@/components/billing/GrantCreditsButton'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { isCurrentUserAdmin } from '@/lib/auth/role'
import {
  getBalance,
  getCurrentWorkspaceId,
  getLedger,
  getPricing,
} from '@/lib/queries/credits'
import { isStripeConfigured } from '@/lib/stripe/client'
import { createClient } from '@/lib/supabase/server'

function fmtAmount(n: number) {
  return n > 0 ? `+${n}` : `${n}`
}

export default async function BillingPage() {
  const workspaceId = await getCurrentWorkspaceId()
  const [balance, ledger, pricing, isAdmin] = await Promise.all([
    workspaceId ? getBalance(workspaceId) : Promise.resolve(0),
    workspaceId ? getLedger(workspaceId) : Promise.resolve([]),
    getPricing(),
    isCurrentUserAdmin(),
  ])

  // Subscription + customer state (RLS lets members read their own).
  const supabase = await createClient()
  const { data: subscription } = workspaceId
    ? await supabase
        .from('subscriptions')
        .select('status, plan, current_period_end')
        .eq('workspace_id', workspaceId)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle()
    : { data: null }
  const { data: customer } = workspaceId
    ? await supabase
        .from('stripe_customers')
        .select('stripe_customer_id')
        .eq('workspace_id', workspaceId)
        .maybeSingle()
    : { data: null }

  const t = await getTranslations('billing')

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">{t('title')}</h1>
        <p className="text-sm text-[var(--color-muted-foreground)]">
          {t('subtitle')}
        </p>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-[var(--color-muted-foreground)]">
            {t('currentBalance')}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-end justify-between gap-4">
          <span className="text-4xl font-bold">{balance}</span>
          {isAdmin && <GrantCreditsButton />}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{t('plan')}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {subscription ? (
            <p className="text-sm">
              <Badge>{subscription.status}</Badge>{' '}
              <span className="text-[var(--color-muted-foreground)]">
                {subscription.plan}
                {subscription.current_period_end
                  ? ` · ${t('renews', { date: new Date(subscription.current_period_end).toLocaleDateString() })}`
                  : ''}
              </span>
            </p>
          ) : (
            <p className="text-sm text-[var(--color-muted-foreground)]">
              {t('noSubscription')}
            </p>
          )}
          <BillingActions
            configured={isStripeConfigured()}
            hasCustomer={!!customer?.stripe_customer_id}
          />
        </CardContent>
      </Card>

      <div>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-[var(--color-muted-foreground)]">
          {t('pricing')}
        </h2>
        <div className="flex flex-wrap gap-2 text-sm">
          {pricing.map((p) => (
            <Badge key={p.action}>
              {p.action}: {p.credits}
            </Badge>
          ))}
        </div>
      </div>

      <div>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-[var(--color-muted-foreground)]">
          {t('history')}
        </h2>
        {ledger.length === 0 ? (
          <p className="text-sm text-[var(--color-muted-foreground)]">
            {t('noActivity')}
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)] text-start">
                <th className="py-2 font-medium">{t('colWhen')}</th>
                <th className="py-2 font-medium">{t('colType')}</th>
                <th className="py-2 font-medium">{t('colDetail')}</th>
                <th className="py-2 text-end font-medium">{t('colAmount')}</th>
              </tr>
            </thead>
            <tbody>
              {ledger.map((e) => (
                <tr key={e.id} className="border-b border-[var(--color-border)]">
                  <td className="py-2 text-[var(--color-muted-foreground)]">
                    {new Date(e.created_at).toLocaleString()}
                  </td>
                  <td className="py-2">{e.entry_type}</td>
                  <td className="py-2 text-[var(--color-muted-foreground)]">
                    {e.action ?? e.reason ?? '—'}
                  </td>
                  <td
                    className={`py-2 text-right tabular-nums ${e.amount < 0 ? 'text-red-700' : 'text-green-700'}`}
                  >
                    {fmtAmount(e.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
