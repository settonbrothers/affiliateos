'use client'

import { useState, useTransition } from 'react'

import { Button } from '@/components/ui/button'
import { promoteGoldenToOffer } from '@/lib/actions/golden'

export function PromoteGoldenButton({ id }: { id: string }) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function onClick() {
    setError(null)
    startTransition(async () => {
      // On success the action redirects to the new offer; only errors return.
      const result = await promoteGoldenToOffer(id)
      if (result && 'error' in result) setError(result.error)
    })
  }

  return (
    <div className="flex flex-col gap-1">
      <Button size="sm" disabled={isPending} onClick={onClick}>
        {isPending ? 'Promoting…' : 'Promote to offer'}
      </Button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  )
}
