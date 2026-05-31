'use client'

import { useState, useTransition } from 'react'

import { Button } from '@/components/ui/button'
import { activatePrompt } from '@/lib/actions/prompts'

export function ActivatePromptButton({
  promptId,
  isActive,
}: {
  promptId: string
  isActive: boolean
}) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  if (isActive) {
    return (
      <span className="text-sm text-[var(--color-muted-foreground)]">
        Currently active
      </span>
    )
  }

  function onClick() {
    setError(null)
    startTransition(async () => {
      const result = await activatePrompt(promptId)
      if (result && 'error' in result) setError(result.error)
    })
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button size="sm" disabled={isPending} onClick={onClick}>
        {isPending ? 'Activating…' : 'Activate this version'}
      </Button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  )
}
