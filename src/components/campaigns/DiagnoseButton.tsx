'use client'

import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import { triggerDiagnose } from '@/lib/actions/campaigns'
import { createClient } from '@/lib/supabase/client'
import type { AiRunStatus } from '@/types/db'

const TERMINAL: AiRunStatus[] = ['success', 'failed', 'partial']

export function DiagnoseButton({
  campaignId,
  hasResults,
  hasDiagnosis,
}: {
  campaignId: string
  hasResults: boolean
  hasDiagnosis: boolean
}) {
  const router = useRouter()
  const t = useTranslations('campaigns')
  const [status, setStatus] = useState<AiRunStatus | 'idle'>('idle')
  const [runId, setRunId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const isRunning = status === 'pending' || status === 'running'
  const statusRef = useRef(status)
  useEffect(() => { statusRef.current = status }, [status])

  useEffect(() => {
    if (!runId || !isRunning) return
    const supabase = createClient()
    const channel = supabase
      .channel(`diagnosis_run:${runId}`)
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
      .subscribe((subscribeStatus) => {
        if (subscribeStatus === 'CHANNEL_ERROR' || subscribeStatus === 'TIMED_OUT') {
          setStatus('failed')
          setError('Connection lost. Please refresh and try again.')
        }
      })

    const timeout = setTimeout(() => {
      if (statusRef.current === 'running' || statusRef.current === 'pending') {
        setStatus('failed')
        setError('Timed out. The generation may still be running — refresh to check.')
        void supabase.removeChannel(channel)
      }
    }, 90_000)

    return () => {
      clearTimeout(timeout)
      void supabase.removeChannel(channel)
    }
  }, [runId, isRunning, router])

  async function onClick() {
    setError(null)
    setStatus('running')
    try {
      const result = await triggerDiagnose(campaignId)
      if ('error' in result) {
        setError(result.error)
        setStatus('idle')
        return
      }
      setRunId(result.run_id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unexpected error')
      setStatus('idle')
    }
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <Button onClick={onClick} disabled={isRunning || !hasResults}>
        {isRunning
          ? t('analyzing')
          : hasDiagnosis
            ? t('rerunDiagnosis')
            : t('analyzeResults')}
      </Button>
      {!hasResults && (
        <p className="text-sm text-[var(--color-muted-foreground)]">
          {t('saveResultsFirst')}
        </p>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  )
}
