'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'
import { triggerAnalyze } from '@/lib/actions/offers'
import { createClient } from '@/lib/supabase/client'
import type { AiRunStatus } from '@/types/db'

const TERMINAL: AiRunStatus[] = ['success', 'failed', 'partial']

export function AnalyzeButton({
  offerId,
  initialStatus,
}: {
  offerId: string
  initialStatus: AiRunStatus | null
}) {
  const router = useRouter()
  const [status, setStatus] = useState<AiRunStatus | 'idle'>(
    initialStatus ?? 'idle'
  )
  const [runId, setRunId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const isRunning = status === 'pending' || status === 'running'

  // Subscribe to UPDATEs on the active ai_run via Supabase Realtime.
  // ai_runs is in the supabase_realtime publication (migration 0006); RLS
  // (users read own ai_runs) lets the owning user receive the event.
  useEffect(() => {
    if (!runId || !isRunning) return

    const supabase = createClient()
    const channel = supabase
      .channel(`ai_run:${runId}`)
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

  async function onAnalyze() {
    setError(null)
    setStatus('running')
    const result = await triggerAnalyze(offerId)
    if ('error' in result) {
      setError(result.error)
      setStatus('idle')
      return
    }
    setRunId(result.run_id)
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button onClick={onAnalyze} disabled={isRunning}>
        {isRunning ? 'Analyzing…' : 'Analyze'}
      </Button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  )
}
