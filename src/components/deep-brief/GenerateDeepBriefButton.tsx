'use client'

import { ScanPanel } from '@/components/ai/ScanPanel'
import { Button } from '@/components/ui/button'
import { useAiRunStatus } from '@/hooks/useAiRunStatus'
import { triggerGenerateDeepBrief } from '@/lib/actions/deepBrief'
import type { AiRunStatus } from '@/types/db'

export function GenerateDeepBriefButton({
  offerId,
  initialStatus,
  initialRunId,
  hasBrief,
}: {
  offerId: string
  initialStatus: AiRunStatus | null
  initialRunId?: string | null
  hasBrief: boolean
}) {
  const { setStatus, isRunning, setRunId, error, setError } =
    useAiRunStatus(initialStatus, initialRunId)

  async function onGenerate() {
    setError(null)
    setStatus('running')
    try {
      const result = await triggerGenerateDeepBrief(offerId)
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
          : hasBrief
            ? 'Regenerate Deep Brief'
            : 'Generate Deep Brief'}
      </Button>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {isRunning && (
        <ScanPanel
          title="DEEP BRIEF"
          steps={['reading the page', 'gap-fill research', 'framing the angle', 'drafting the brief']}
        />
      )}
    </div>
  )
}
