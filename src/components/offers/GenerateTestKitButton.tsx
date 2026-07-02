'use client'

import { useTranslations } from 'next-intl'

import { Button } from '@/components/ui/button'
import { useAiRunStatus } from '@/hooks/useAiRunStatus'
import { triggerGenerateTestKit } from '@/lib/actions/testKit'
import type { AiRunStatus } from '@/types/db'

export function GenerateTestKitButton({
  offerId,
  initialStatus,
  initialRunId,
  hasVerdict,
  hasKit,
}: {
  offerId: string
  initialStatus: AiRunStatus | null
  initialRunId?: string | null
  hasVerdict: boolean
  hasKit: boolean
}) {
  const t = useTranslations('offers')
  const { setStatus, isRunning, setRunId, error, setError } =
    useAiRunStatus(initialStatus, initialRunId)

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
        {t('testKitNeedsVerdict')}
      </p>
    )
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <Button onClick={onGenerate} disabled={isRunning}>
        {isRunning
          ? t('generating')
          : hasKit
            ? t('regenerateTestKit')
            : t('generateTestKit')}
      </Button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  )
}
