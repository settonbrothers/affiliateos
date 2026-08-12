'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

import { resumeRun } from '@/lib/actions/discovery'

/**
 * Shown when a run still has candidates waiting at 'triaged'.
 *
 * The deep pass hands off to itself to get a fresh clock; if a hand-off is
 * refused the run finishes early and says so. This picks it back up. It exists
 * because an automatic chain with no manual override is one failed fetch away
 * from the stranded-run bug it was built to fix.
 */
export function ResumeRunButton({
  runId,
  pending,
}: {
  runId: string
  pending: number
}) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  return (
    <div className="flex items-center gap-3">
      <button
        disabled={isPending}
        onClick={() =>
          startTransition(async () => {
            const res = await resumeRun(runId)
            if (res?.error) setError(res.error)
            else {
              setError(null)
              router.refresh()
            }
          })
        }
        style={{
          border: '1px solid var(--accent-border)',
          background: 'var(--accent-fill)',
          color: 'var(--primary)',
          padding: '8px 14px',
          fontFamily: 'var(--font-mono)',
          fontSize: '11px',
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          cursor: isPending ? 'wait' : 'pointer',
          opacity: isPending ? 0.6 : 1,
        }}
      >
        {isPending ? 'Resuming…' : `Analyse the remaining ${pending}`}
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  )
}
