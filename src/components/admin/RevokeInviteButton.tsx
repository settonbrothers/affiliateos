'use client'

import { useState, useTransition } from 'react'

import { Button } from '@/components/ui/button'
import { revokeInviteCode } from '@/lib/actions/invites'

export function RevokeInviteButton({ id }: { id: string }) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function onClick() {
    setError(null)
    startTransition(async () => {
      const result = await revokeInviteCode(id)
      if (result && 'error' in result) setError(result.error)
    })
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button size="sm" variant="outline" disabled={isPending} onClick={onClick}>
        {isPending ? '…' : 'Revoke'}
      </Button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  )
}
