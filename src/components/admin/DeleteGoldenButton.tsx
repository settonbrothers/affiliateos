'use client'

import { useState, useTransition } from 'react'

import { Button } from '@/components/ui/button'
import { deleteGoldenOffer } from '@/lib/actions/golden'

export function DeleteGoldenButton({ id }: { id: string }) {
  const [isPending, startTransition] = useTransition()
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function onClick() {
    if (!confirming) {
      setConfirming(true)
      return
    }
    setError(null)
    startTransition(async () => {
      const result = await deleteGoldenOffer(id)
      if (result && 'error' in result) {
        setError(result.error)
        setConfirming(false)
      }
    })
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        size="sm"
        variant="outline"
        disabled={isPending}
        onClick={onClick}
      >
        {isPending ? 'Removing…' : confirming ? 'Confirm remove' : 'Remove'}
      </Button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  )
}
