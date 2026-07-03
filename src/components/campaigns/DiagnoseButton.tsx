'use client'

import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

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
      .subscribe()
    return () => {
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
