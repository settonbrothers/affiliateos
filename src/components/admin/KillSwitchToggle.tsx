'use client'

import { useState, useTransition } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toggleKillSwitch } from '@/lib/actions/killSwitches'

export type KillSwitchRow = {
  orchestrator_name: string
  is_paused: boolean
  reason: string | null
  paused_at: string | null
}

export function KillSwitchToggle({ row }: { row: KillSwitchRow }) {
  const [isPending, startTransition] = useTransition()
  const [reason, setReason] = useState('')

  function onClick() {
    startTransition(async () => {
      await toggleKillSwitch(
        row.orchestrator_name,
        !row.is_paused,
        reason || undefined
      )
      setReason('')
    })
  }

  return (
    <div className="flex items-center justify-between gap-4 rounded-none border border-[var(--color-border)] p-4">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <span className="font-medium">{row.orchestrator_name}</span>
          <Badge>{row.is_paused ? 'paused' : 'active'}</Badge>
        </div>
        {row.is_paused && (
          <p className="text-xs text-[var(--color-muted-foreground)]">
            since{' '}
            {row.paused_at ? new Date(row.paused_at).toLocaleString() : '—'}
            {row.reason ? ` · ${row.reason}` : ''}
          </p>
        )}
      </div>
      <div className="flex items-center gap-2">
        {!row.is_paused && (
          <Input
            className="w-56"
            placeholder="reason (optional)"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        )}
        <Button
          variant={row.is_paused ? 'default' : 'outline'}
          disabled={isPending}
          onClick={onClick}
        >
          {isPending ? '…' : row.is_paused ? 'Resume' : 'Pause'}
        </Button>
      </div>
    </div>
  )
}
