'use client'

import { useState, useTransition } from 'react'

import { Button } from '@/components/ui/button'
import { createCampaign } from '@/lib/actions/campaigns'

export function CreateCampaignButton({
  offerId,
  testKitId,
}: {
  offerId: string
  testKitId: string | null
}) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function onClick() {
    setError(null)
    startTransition(async () => {
      const result = await createCampaign(offerId, testKitId)
      if (result && 'error' in result) setError(result.error)
    })
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <Button variant="outline" disabled={isPending} onClick={onClick}>
        {isPending ? 'Creating…' : 'Create campaign from this kit'}
      </Button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  )
}
