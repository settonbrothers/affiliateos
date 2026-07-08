import { getTranslations } from 'next-intl/server'

import { BillingActions } from '@/components/billing/BillingActions'
import { GrantCreditsButton } from '@/components/billing/GrantCreditsButton'
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

function fmtWhen(iso: string) {
  const d = new Date(iso)
  return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  })}`
}

function SectionHeading({ label, note }: { label: string; note?: string }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'baseline',
        gap: '14px',
        marginBottom: '16px',
      }}
    >
      <span
        style={{ width: '4px', height: '20px', background: 'var(--primary)' }}
      />
      <span
        dir="ltr"
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: '22px',
          fontWeight: 600,
          letterSpacing: '0.03em',
          color: 'var(--foreground)',
        }}
      >
        {label}
      </span>
      {note && (
        <span
          style={{
            fontFamily: 'var(--font-sans)',
            fontSize: '12px',
            color: 'var(--muted-faint)',
            marginInlineStart: 'auto',
          }}
        >
          {note}
        </span>
      )}
    </div>
  )
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
  const configured = isStripeConfigured()
  const hasCustomer = !!customer?.stripe_customer_id
  const subActive =
    !!subscription &&
    ['active', 'trialing', 'past_due'].includes(
      subscription.status.toLowerCase()
    )

  return (
    <div style={{ maxWidth: '1160px', width: '100%', margin: '0 auto' }}>
      {/* header */}
      <div
        dir="ltr"
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '11px',
          letterSpacing: '0.22em',
          color: 'var(--primary)',
          marginBottom: '14px',
        }}
      >
        BILLING &amp; CREDITS
      </div>
      <h1
        style={{
          margin: '0 0 8px',
          fontFamily: 'var(--font-sans)',
          fontSize: 'clamp(34px,5vw,56px)',
          fontWeight: 800,
          lineHeight: 0.95,
        }}
      >
        {t('title')}
      </h1>
      <p
        style={{
          margin: '0 0 32px',
          fontSize: '14px',
          color: 'var(--muted-foreground)',
        }}
      >
        {t('subtitle')}
      </p>

      {/* balance + plan */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-[1.3fr_1fr]" style={{ marginBottom: '40px' }}>
        {/* balance card */}
        <div
          style={{
            border: '1px solid rgba(245,197,24,0.40)',
            background:
              'radial-gradient(90% 130% at 22% 0%, #17140A 0%, #0D0B09 62%)',
            padding: 'clamp(24px,3vw,36px)',
          }}
        >
          <div
            dir="ltr"
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '10px',
              letterSpacing: '0.14em',
              color: 'var(--muted-faint)',
            }}
          >
            CURRENT BALANCE · {t('currentBalance')}
          </div>
          <div
            dir="ltr"
            style={{
              display: 'flex',
              alignItems: 'baseline',
              gap: '10px',
              marginTop: '10px',
            }}
          >
            <span
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 'clamp(72px,10vw,124px)',
                fontWeight: 600,
                lineHeight: 0.8,
                color: 'var(--primary)',
              }}
            >
              {balance.toLocaleString('en-US')}
            </span>
            <span style={{ fontSize: '16px', color: 'var(--muted-faint)' }}>
              {t('creditsUnit')}
            </span>
          </div>
          <BillingActions
            configured={configured}
            hasCustomer={hasCustomer}
            slot="buy"
          />
          {isAdmin && (
            <div style={{ marginTop: '18px' }}>
              <GrantCreditsButton />
            </div>
          )}
        </div>

        {/* plan card */}
        <div
          style={{
            border: '1px solid var(--border)',
            background: 'var(--card)',
            padding: 'clamp(24px,3vw,36px)',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div
            dir="ltr"
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '10px',
              letterSpacing: '0.14em',
              color: 'var(--muted-faint)',
            }}
          >
            PLAN · {t('plan')}
          </div>
          {subActive && subscription ? (
            <>
              <div
                style={{
                  marginTop: '14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                }}
              >
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    fontFamily: 'var(--font-sans)',
                    fontSize: '12px',
                    fontWeight: 700,
                    color: 'var(--primary-foreground)',
                    background: 'var(--primary)',
                    padding: '5px 11px',
                  }}
                >
                  {subscription.status}
                </span>
                <span
                  dir="ltr"
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: '20px',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                  }}
                >
                  {subscription.plan}
                </span>
              </div>
              {subscription.current_period_end && (
                <div
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '11.5px',
                    color: 'var(--muted-foreground)',
                    marginTop: '10px',
                  }}
                >
                  {t('renews', {
                    date: new Date(
                      subscription.current_period_end
                    ).toLocaleDateString(),
                  })}
                </div>
              )}
            </>
          ) : (
            <p
              style={{
                marginTop: '14px',
                fontSize: '13px',
                color: 'var(--muted-foreground)',
              }}
            >
              {t('noSubscription')}
            </p>
          )}
          <div style={{ marginTop: 'auto', paddingTop: '18px' }}>
            <BillingActions
              configured={configured}
              hasCustomer={hasCustomer}
              slot="manage"
            />
          </div>
        </div>
      </div>

      {/* pricing */}
      <SectionHeading label="PRICING" note={t('pricingNote')} />
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(150px,1fr))',
          gap: '1px',
          background: 'rgba(255,255,255,0.12)',
          border: '1px solid var(--border)',
          marginBottom: '40px',
        }}
      >
        {pricing.map((p) => (
          <div
            key={p.action}
            style={{
              background: 'var(--background)',
              padding: '16px 18px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '10px',
            }}
          >
            <span style={{ fontSize: '13px', color: 'var(--muted-foreground)' }}>
              {p.action}
            </span>
            <span
              dir="ltr"
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: '20px',
                fontWeight: 600,
                color: 'var(--primary)',
              }}
            >
              {p.credits}
            </span>
          </div>
        ))}
      </div>

      {/* history */}
      <SectionHeading label="HISTORY" />
      {ledger.length === 0 ? (
        <p style={{ fontSize: '14px', color: 'var(--muted-foreground)' }}>
          {t('noActivity')}
        </p>
      ) : (
        <div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '150px minmax(0,1fr) 140px 90px',
              gap: '16px',
              padding: '14px 12px',
              fontFamily: 'var(--font-mono)',
              fontSize: '9.5px',
              letterSpacing: '0.12em',
              color: 'var(--muted-faint)',
              borderBottom: '1px solid var(--border)',
            }}
          >
            <span>{t('colWhen')}</span>
            <span>{t('colDetail')}</span>
            <span>{t('colType')}</span>
            <span style={{ textAlign: 'left' }}>{t('colAmount')}</span>
          </div>
          {ledger.map((e) => (
            <div
              key={e.id}
              style={{
                display: 'grid',
                gridTemplateColumns: '150px minmax(0,1fr) 140px 90px',
                gap: '16px',
                padding: '14px 12px',
                borderBottom: '1px solid rgba(255,255,255,0.08)',
                alignItems: 'center',
              }}
            >
              <span
                dir="ltr"
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '11.5px',
                  color: 'var(--muted-foreground)',
                  textAlign: 'end',
                }}
              >
                {fmtWhen(e.created_at)}
              </span>
              <span style={{ fontSize: '13.5px', color: 'var(--foreground)' }}>
                {e.action ?? e.reason ?? '·'}
              </span>
              <span
                dir="ltr"
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '11px',
                  color: 'var(--muted-faint)',
                }}
              >
                {e.entry_type}
              </span>
              <span
                dir="ltr"
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '13px',
                  fontWeight: 600,
                  color: e.amount > 0 ? 'var(--primary)' : 'var(--muted-foreground)',
                  textAlign: 'left',
                }}
              >
                {fmtAmount(e.amount)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
