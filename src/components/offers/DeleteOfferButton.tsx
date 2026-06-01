'use client'

import { useState, useTransition } from 'react'

import { Button } from '@/components/ui/button'
import { deleteOffer } from '@/lib/actions/offers'

export function DeleteOfferButton({
  offerId,
  offerName,
}: {
  offerId: string
  offerName: string
}) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)

  function onDelete() {
    setError(null)
    startTransition(async () => {
      const result = await deleteOffer(offerId)
      if (result && 'error' in result) setError(result.error)
    })
  }

  if (!confirming) {
    return (
      <Button
        size="sm"
        variant="ghost"
        className="text-red-600 hover:bg-red-50 hover:text-red-700"
        onClick={() => setConfirming(true)}
      >
        Delete
      </Button>
    )
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-2">
        <span className="text-xs text-[var(--color-muted-foreground)]">
          Delete <span className="font-medium">{offerName}</span> and all of
          its sources / facts / runs?
        </span>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setConfirming(false)}
          disabled={isPending}
        >
          Cancel
        </Button>
        <Button
          size="sm"
          className="bg-red-600 text-white hover:bg-red-700"
          onClick={onDelete}
          disabled={isPending}
        >
          {isPending ? 'Deleting…' : 'Confirm delete'}
        </Button>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  )
}
