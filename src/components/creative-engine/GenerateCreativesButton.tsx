'use client'

import { Button } from '@/components/ui/button'
import { useAiRunStatus } from '@/hooks/useAiRunStatus'
import { triggerGenerateCreatives } from '@/lib/actions/creativeEngine'

export function GenerateCreativesButton({
  offerId,
  initialStatus,
  initialRunId,
  hasCreatives,
}: {
  offerId: string
  initialStatus: import('@/types/db').AiRunStatus | null
  initialRunId?: string | null
  hasCreatives: boolean
}) {
  const { status, setStatus, isRunning, setRunId, error, setError } =
    useAiRunStatus(initialStatus, initialRunId)

  async function onGenerate() {
    setError(null)
    setStatus('running')
    try {
      const result = await triggerGenerateCreatives(offerId)
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
      <Button onClick={onGenerate} disabled={isRunning}>
        {isRunning
          ? 'Generating…'
          : hasCreatives
            ? 'Regenerate Creatives'
            : 'Generate Creatives'}
      </Button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  )
}
