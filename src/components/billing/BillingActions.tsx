'use client'

import { useState, useTransition } from 'react'

import { Button } from '@/components/ui/button'
import {
  createCheckoutSession,
  createPortalSession,
} from '@/lib/actions/stripe'

export function BillingActions({
  configured,
  hasCustomer,
}: {
  configured: boolean
  hasCustomer: boolean
}) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  if (!configured) {
    return (
      <p className="text-sm text-[var(--color-muted-foreground)]">
        Billing isn&apos;t configured yet (Stripe keys missing). Add{' '}
        <code>STRIPE_SECRET_KEY</code> to enable checkout.
      </p>
    )
  }

  function go(run: () => Promise<{ url: string } | { error: string }>) {
    setError(null)
    startTransition(async () => {
      const result = await run()
      if ('url' in result) window.location.href = result.url
      else setError(result.error)
    })
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        <Button
          disabled={isPending}
          onClick={() => go(() => createCheckoutSession('subscription'))}
        >
          Subscribe — Pro ($50/mo, 50 credits)
        </Button>
        <Button
          variant="outline"
          disabled={isPending}
          onClick={() => go(() => createCheckoutSession('credits'))}
        >
          Buy 30 credits ($20)
        </Button>
        {hasCustomer && (
          <Button
            variant="outline"
            disabled={isPending}
            onClick={() => go(() => createPortalSession())}
          >
            Manage billing
          </Button>
        )}
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  )
}
