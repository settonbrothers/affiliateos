'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

import { createClient } from '@/lib/supabase/client'
import type { AiRunStatus } from '@/types/db'

const TERMINAL: AiRunStatus[] = ['success', 'failed', 'partial']
const POLL_MS = 4_000

/**
 * Manages the live status of a single ai_runs row.
 *
 * Uses a Supabase Realtime subscription for instant updates, with a polling
 * fallback every 4 s so the UI never stays stuck if Realtime misses an event.
 * Accepts `initialRunId` so that a mid-run page reload resumes tracking
 * automatically without requiring a new button click.
 */
export function useAiRunStatus(
  initialStatus: AiRunStatus | null,
  initialRunId?: string | null
) {
  const router = useRouter()
  const [status, setStatus] = useState<AiRunStatus | 'idle'>(
    initialStatus ?? 'idle'
  )
  const [runId, setRunId] = useState<string | null>(initialRunId ?? null)
  const [error, setError] = useState<string | null>(null)

  const isRunning = status === 'pending' || status === 'running'

  useEffect(() => {
    if (!runId || !isRunning) return

    const supabase = createClient()
    let resolved = false

    function resolve(next: AiRunStatus) {
      if (resolved) return
      resolved = true
      setStatus(next)
      router.refresh()
    }

    const channel = supabase
      .channel(`ai_run_status:${runId}`)
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
          if (TERMINAL.includes(next)) resolve(next)
        }
      )
      .subscribe()

    const poll = setInterval(async () => {
      if (resolved) return
      const { data } = await supabase
        .from('ai_runs')
        .select('status')
        .eq('id', runId)
        .single()
      if (data && TERMINAL.includes(data.status as AiRunStatus)) {
        resolve(data.status as AiRunStatus)
      }
    }, POLL_MS)

    return () => {
      clearInterval(poll)
      void supabase.removeChannel(channel)
    }
  }, [runId, isRunning, router])

  return { status, setStatus, isRunning, runId, setRunId, error, setError }
}
