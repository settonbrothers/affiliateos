'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

import { createClient } from '@/lib/supabase/client'
import type { AiRunStatus } from '@/types/db'

const TERMINAL: AiRunStatus[] = ['success', 'failed', 'partial']
const POLL_MS = 4_000
const MAX_RUNNING_MS = 10 * 60 * 1_000 // 10 min — safety valve if the DB row is permanently stuck

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
      .subscribe((subscribeStatus) => {
        if (subscribeStatus === 'CHANNEL_ERROR' || subscribeStatus === 'TIMED_OUT') {
          setStatus('idle')
          setError('Connection lost. Please refresh and try again.')
        }
      })

    const startedAt = Date.now()

    // 90-second timeout fallback for the realtime channel.
    const realtimeTimeout = setTimeout(() => {
      if (!resolved) {
        resolved = true
        setStatus('idle')
        setError('Timed out. The generation may still be running — refresh to check.')
        void supabase.removeChannel(channel)
      }
    }, 90_000)

    const poll = setInterval(async () => {
      if (resolved) return
      // Safety valve: if the run has been stuck for 10+ minutes, reset to idle
      // so the user can retry rather than waiting forever.
      if (Date.now() - startedAt > MAX_RUNNING_MS) {
        resolved = true
        setStatus('idle')
        setError('Generation timed out — please try again.')
        return
      }
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
      clearTimeout(realtimeTimeout)
      clearInterval(poll)
      void supabase.removeChannel(channel)
    }
  }, [runId, isRunning, router])

  return { status, setStatus, isRunning, runId, setRunId, error, setError }
}
