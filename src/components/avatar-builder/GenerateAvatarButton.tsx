'use client'

import { Button } from '@/components/ui/button'
import { useAiRunStatus } from '@/hooks/useAiRunStatus'
import { triggerGenerateAvatar } from '@/lib/actions/avatarBuilder'
import type { AiRunStatus } from '@/types/db'

export function GenerateAvatarButton({
  offerId,
  initialStatus,
  initialRunId,
  hasAvatar,
}: {
  offerId: string
  initialStatus: AiRunStatus | null
  initialRunId?: string | null
  hasAvatar: boolean
}) {
  const { setStatus, isRunning, setRunId, error, setError } =
    useAiRunStatus(initialStatus, initialRunId)

  async function onGenerate() {
    setError(null)
    setStatus('running')
    try {
      const result = await triggerGenerateAvatar(offerId)
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
          : hasAvatar
            ? 'Regenerate Avatar'
            : 'Generate Avatar'}
      </Button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  )
}
