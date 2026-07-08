'use client'

import { useState } from 'react'

import { ScanPanel } from '@/components/ai/ScanPanel'
import { Button } from '@/components/ui/button'
import { useAiRunStatus } from '@/hooks/useAiRunStatus'
import { triggerGenerateCreatives } from '@/lib/actions/creativeEngine'
import { CreativeReferenceUpload } from './CreativeReferenceUpload'

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
  const [referenceImageBase64, setReferenceImageBase64] = useState<string | null>(null)

  async function onGenerate() {
    setError(null)
    setStatus('running')
    try {
      const result = await triggerGenerateCreatives(offerId, referenceImageBase64 ?? undefined)
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
    <div className="flex flex-col items-start gap-3">
      <CreativeReferenceUpload onImageChange={setReferenceImageBase64} disabled={isRunning} />
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
      {isRunning && (
        <ScanPanel
          title="CREATIVES"
          steps={['reading selected hooks', 'designing concepts', 'generating images', 'finalizing 7 creatives']}
        />
      )}
    </div>
  )
}
