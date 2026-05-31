'use client'

import { useState, useTransition } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { triggerIngestSource } from '@/lib/actions/sources'

type Msg = { type: 'error' | 'info'; text: string }

export function AddSourceForm({ offerId }: { offerId: string }) {
  const [url, setUrl] = useState('')
  const [isPending, startTransition] = useTransition()
  const [msg, setMsg] = useState<Msg | null>(null)

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setMsg(null)
    startTransition(async () => {
      const result = await triggerIngestSource(offerId, url)
      if ('error' in result) {
        setMsg({ type: 'error', text: result.error })
      } else {
        setMsg({
          type: 'info',
          text: `Queued (job ${result.job_id.slice(0, 8)}…). Refresh in a few seconds to see facts.`,
        })
        setUrl('')
      }
    })
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="source-url">URL</Label>
        <Input
          id="source-url"
          type="url"
          placeholder="https://example.com/affiliate-program"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          required
        />
      </div>
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
      <Button type="submit" disabled={isPending || !url}>
        {isPending ? 'Queueing…' : 'Fetch + extract'}
      </Button>
    </form>
  )
}
