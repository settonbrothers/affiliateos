'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'
import { triggerGenerateTestKit } from '@/lib/actions/testKit'
import { createClient } from '@/lib/supabase/client'
import type { AiRunStatus } from '@/types/db'

const TERMINAL: AiRunStatus[] = ['success', 'failed', 'partial']

export function GenerateTestKitButton({
  offerId,
  initialStatus,
  hasVerdict,
  hasKit,
}: {
  offerId: string
  initialStatus: AiRunStatus | null
  hasVerdict: boolean
  hasKit: boolean
}) {
  const router = useRouter()
  const [status, setStatus] = useState<AiRunStatus | 'idle'>(
    initialStatus ?? 'idle'
  )
  const [runId, setRunId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const isRunning = status === 'pending' || status === 'running'

  useEffect(() => {
    if (!runId || !isRunning) return
    const supabase = createClient()
    const channel = supabase
      .channel(`testkit_run:${runId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'ai_runs',
          filter: `id=eq.${runId}`,
        },
        (payload) => {
          const next = (payload.new as { status: AiRunStatus }).status
          if (TERMINAL.includes(next)) {
            setStatus(next)
            router.refresh()
          }
        }
      )
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [runId, isRunning, router])

  async function onGenerate() {
    setError(null)
    setStatus('running')
    const result = await triggerGenerateTestKit(offerId)
    if ('error' in result) {
      setError(result.error)
      setStatus('idle')
      return
    }
    setRunId(result.run_id)
  }

  if (!hasVerdict) {
    return (
      <p className="text-sm text-[var(--color-muted-foreground)]">
        Run an analysis first — the test kit is built from the verdict.
      </p>
    )
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <Button onClick={onGenerate} disabled={isRunning}>
        {isRunning
          ? 'Generating…'
          : hasKit
            ? 'Regenerate test kit'
            : 'Generate test kit'}
      </Button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  )
}
