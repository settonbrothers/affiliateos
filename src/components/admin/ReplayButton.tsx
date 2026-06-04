'use client'

import { useState, useTransition } from 'react'

import { Button } from '@/components/ui/button'
import { replayFailedMessage } from '@/lib/actions/dlq'

type Msg = { type: 'error' | 'info'; text: string }

export function ReplayButton({
  id,
  replayable,
}: {
  id: string
  replayable: boolean
}) {
  const [isPending, startTransition] = useTransition()
  const [msg, setMsg] = useState<Msg | null>(null)

  function onClick() {
    setMsg(null)
    startTransition(async () => {
      const result = await replayFailedMessage(id)
      if ('error' in result) setMsg({ type: 'error', text: result.error })
      else setMsg({ type: 'info', text: 'Replayed — run re-queued.' })
    })
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        size="sm"
        disabled={isPending || !replayable}
        onClick={onClick}
        title={replayable ? undefined : 'No replayer for this message type'}
      >
        {isPending ? 'Replaying…' : 'Replay'}
      </Button>
      {msg && (
        <p
          className={
            msg.type === 'error'
              ? 'text-sm text-red-600'
              : 'text-sm text-[var(--color-muted-foreground)]'
          }
        >
          {msg.text}
        </p>
      )}
    </div>
  )
}
