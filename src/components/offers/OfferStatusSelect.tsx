'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

import { updateOfferStatus } from '@/lib/actions/offers'
import { OFFER_STATUS_LABELS } from '@/lib/offers/status'
import { OFFER_STATUSES } from '@/lib/validations/offer'
import type { OfferStatus } from '@/types/db'

export function OfferStatusSelect({
  offerId,
  status,
}: {
  offerId: string
  status: OfferStatus
}) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  return (
    <div className="flex items-center gap-2">
      <select
        defaultValue={status}
        disabled={isPending}
        onChange={(e) => {
          const next = e.target.value
          startTransition(async () => {
            const res = await updateOfferStatus(offerId, next)
            if (res?.error) {
              setError(res.error)
            } else {
              setError(null)
              router.refresh()
            }
          })
        }}
        className="rounded-md border border-[var(--color-border)] bg-transparent px-2 py-1 text-sm"
      >
        {OFFER_STATUSES.map((s) => (
          <option key={s} value={s}>
            {OFFER_STATUS_LABELS[s]}
          </option>
        ))}
      </select>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  )
}
