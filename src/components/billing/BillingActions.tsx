'use client'

import { useTranslations } from 'next-intl'
import { useState, useTransition } from 'react'

import {
  createCheckoutSession,
  createPortalSession,
} from '@/lib/actions/stripe'
import { CREDIT_PACK } from '@/lib/stripe/products'

/**
 * AFFEX-styled billing actions. `slot` picks which controls render so the page
 * can place the primary "top up" CTA inside the balance card and the
 * subscription controls inside the plan card (per the Billing mock).
 */
export function BillingActions({
  configured,
  hasCustomer,
  slot,
}: {
  configured: boolean
  hasCustomer: boolean
  slot: 'buy' | 'manage'
}) {
  const t = useTranslations('billing')
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function go(run: () => Promise<{ url: string } | { error: string }>) {
    setError(null)
    startTransition(async () => {
      const result = await run()
      if ('url' in result) window.location.href = result.url
      else setError(result.error)
    })
  }

  if (!configured) {
    if (slot === 'manage') return null
    return (
      <p
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '11px',
          letterSpacing: '0.06em',
          color: 'var(--muted-faint)',
        }}
      >
        STRIPE NOT CONFIGURED
      </p>
    )
  }

  if (slot === 'buy') {
    return (
      <div className="flex flex-col gap-2" style={{ marginTop: '26px' }}>
        <button
          disabled={isPending}
          onClick={() => go(() => createCheckoutSession('credits'))}
          className="affex-cta"
          style={{
            alignSelf: 'flex-start',
            fontFamily: 'var(--font-sans)',
            fontSize: '15px',
            fontWeight: 700,
            color: 'var(--primary-foreground)',
            background: 'var(--primary)',
            border: 'none',
            padding: '13px 26px',
            cursor: isPending ? 'default' : 'pointer',
            opacity: isPending ? 0.6 : 1,
          }}
        >
          {t('topUp')} ‹
        </button>
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '10.5px',
            letterSpacing: '0.06em',
            color: 'var(--muted-faint)',
          }}
        >
          {CREDIT_PACK.credits} CR · ${CREDIT_PACK.amount_cents / 100}
        </span>
        {error && (
          <p style={{ fontSize: '13px', color: '#F06A6A' }}>{error}</p>
        )}
      </div>
    )
  }

  // slot === 'manage'
  return (
    <div>
      <div style={{ display: 'flex', gap: '18px', flexWrap: 'wrap' }}>
        {hasCustomer ? (
          <>
            <button
              disabled={isPending}
              onClick={() => go(() => createPortalSession())}
              style={{
                background: 'none',
                border: 'none',
                padding: 0,
                fontFamily: 'var(--font-sans)',
                fontSize: '13px',
                color: 'var(--foreground)',
                borderBottom: '1px solid var(--border)',
                paddingBottom: '3px',
                cursor: isPending ? 'default' : 'pointer',
              }}
            >
              {t('manageSub')}
            </button>
            <button
              disabled={isPending}
              onClick={() => go(() => createPortalSession())}
              style={{
                background: 'none',
                border: 'none',
                padding: 0,
                fontFamily: 'var(--font-sans)',
                fontSize: '13px',
                color: 'var(--muted-foreground)',
                cursor: isPending ? 'default' : 'pointer',
              }}
            >
              {t('invoices')}
            </button>
          </>
        ) : (
          <button
            disabled={isPending}
            onClick={() => go(() => createCheckoutSession('subscription'))}
            className="affex-cta"
            style={{
              fontFamily: 'var(--font-sans)',
              fontSize: '14px',
              fontWeight: 700,
              color: 'var(--primary-foreground)',
              background: 'var(--primary)',
              border: 'none',
              padding: '11px 22px',
              cursor: isPending ? 'default' : 'pointer',
              opacity: isPending ? 0.6 : 1,
            }}
          >
            {t('upgradePro')} ‹
          </button>
        )}
      </div>
      {error && (
        <p style={{ fontSize: '13px', color: '#F06A6A', marginTop: '8px' }}>
          {error}
        </p>
      )}
    </div>
  )
}
