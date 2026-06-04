'use client'

import { useState, useTransition } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { grantCredits } from '@/lib/actions/credits'

export function GrantCreditsButton() {
  const [amount, setAmount] = useState('100')
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function onClick() {
    setError(null)
    startTransition(async () => {
      const result = await grantCredits(Number(amount))
      if (result && 'error' in result) setError(result.error)
    })
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <Input
          type="number"
          className="w-28"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
        <Button variant="outline" disabled={isPending} onClick={onClick}>
          {isPending ? 'Granting…' : 'Grant credits (admin)'}
        </Button>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  )
}
