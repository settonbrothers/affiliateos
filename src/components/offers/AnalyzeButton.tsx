'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { triggerAnalyze } from '@/lib/actions/offers'
import { createClient } from '@/lib/supabase/client'
import type { AiRunStatus } from '@/types/db'

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
  const [error, setError] = useState<string | null>(null)

  const isRunning = status === 'pending' || status === 'running'

  // M1: poll ai_runs every 2s. Replaced by Supabase Realtime in M1 Task 6.2.
  function pollRun(runId: string) {
    const supabase = createClient()
    const interval = setInterval(async () => {
      const { data } = await supabase
        .from('ai_runs')
        .select('status')
        .eq('id', runId)
        .maybeSingle()
      const next = (data as { status: AiRunStatus } | null)?.status
      if (next === 'success' || next === 'failed' || next === 'partial') {
        clearInterval(interval)
        setStatus(next)
        router.refresh()
      }
    }, 2000)
  }

  async function onAnalyze() {
    setError(null)
    setStatus('running')
    const result = await triggerAnalyze(offerId)
    if ('error' in result) {
      setError(result.error)
      setStatus('idle')
      return
    }
    pollRun(result.run_id)
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
