'use client'

import { useTranslations } from 'next-intl'

import { AnalyzingOverlay } from '@/components/ai/AnalyzingOverlay'
import { Button } from '@/components/ui/button'
import { useAiRunStatus } from '@/hooks/useAiRunStatus'
import { triggerAnalyze } from '@/lib/actions/offers'
import type { AiRunStatus } from '@/types/db'

export function AnalyzeButton({
  offerId,
  offerName,
  offerUrl,
  initialStatus,
  initialRunId,
}: {
  offerId: string
  offerName: string
  offerUrl?: string | null
  initialStatus: AiRunStatus | null
  initialRunId?: string | null
}) {
  const t = useTranslations('offers')
  const { setStatus, isRunning, setRunId, error, setError } =
    useAiRunStatus(initialStatus, initialRunId)

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
        {isRunning ? t('analyzing') : t('analyze')}
      </Button>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <AnalyzingOverlay running={isRunning} offerName={offerName} offerUrl={offerUrl} />
    </div>
  )
}
