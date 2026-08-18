'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

import { prepareCopyEvalSuite, startCopyEvalRun } from '@/lib/actions/copyEval'
import { Button } from '@/components/ui/button'

export function CopyEvalControls() {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [message, setMessage] = useState('')
  const run = (kind: 'prepare' | 'start') =>
    startTransition(async () => {
      try {
        if (kind === 'prepare') {
          const result = await prepareCopyEvalSuite()
          setMessage(
            result.created
              ? `נחתמו ${result.created} מקרים.`
              : 'שמונת המקרים כבר חתומים.'
          )
          router.refresh()
        } else {
          const result = await startCopyEvalRun()
          router.push(`/admin/eval/copy/${result.runId}`)
        }
      } catch (error) {
        setMessage(error instanceof Error ? error.message : 'הפעולה נכשלה')
      }
    })
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button disabled={pending} onClick={() => run('prepare')}>
        1. הכנת 8 snapshots
      </Button>
      <Button disabled={pending} variant="outline" onClick={() => run('start')}>
        2. פתיחת ריצת 48 jobs
      </Button>
      {message && (
        <span className="text-sm text-[var(--color-muted-foreground)]">
          {message}
        </span>
      )}
    </div>
  )
}
