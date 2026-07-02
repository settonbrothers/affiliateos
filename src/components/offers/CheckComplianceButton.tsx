'use client'

import { useTranslations } from 'next-intl'

import { Button } from '@/components/ui/button'
import { useAiRunStatus } from '@/hooks/useAiRunStatus'
import { triggerCheckCompliance } from '@/lib/actions/compliance'

export function CheckComplianceButton({
  offerId,
  hasReport,
}: {
  offerId: string
  hasReport: boolean
}) {
  const t = useTranslations('offers')
  const { setStatus, isRunning, setRunId, error, setError } =
    useAiRunStatus(null)

  async function onClick() {
    setError(null)
    setStatus('running')
    const result = await triggerCheckCompliance(offerId)
    if ('error' in result) {
      setError(result.error)
      setStatus('idle')
      return
    }
    setRunId(result.run_id)
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <Button onClick={onClick} disabled={isRunning}>
        {isRunning
          ? t('checking')
          : hasReport
            ? t('recheckCompliance')
            : t('checkCompliance')}
      </Button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  )
}
