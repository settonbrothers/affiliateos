'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'
import { triggerDiagnoseCreatives } from '@/lib/actions/diagnoseV2'
import { createClient } from '@/lib/supabase/client'
import type { AiRunStatus } from '@/types/db'

const TERMINAL: AiRunStatus[] = ['success', 'failed', 'partial']

export function DiagnoseCreativesForm({ campaignId }: { campaignId: string }) {
  const router = useRouter()
  const [creativeInput, setCreativeInput] = useState('')
  const [status, setStatus] = useState<AiRunStatus | 'idle'>('idle')
  const [runId, setRunId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const isRunning = status === 'pending' || status === 'running'

  useEffect(() => {
    if (!runId || !isRunning) return
    const supabase = createClient()
    const channel = supabase
      .channel(`diagnosis_v2_run:${runId}`)
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

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!creativeInput.trim()) return
    setError(null)
    setStatus('running')
    try {
      const result = await triggerDiagnoseCreatives(campaignId, creativeInput)
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
    <form onSubmit={onSubmit} className="flex flex-col gap-3">
      <textarea
        value={creativeInput}
        onChange={(e) => setCreativeInput(e.target.value)}
        placeholder="הדבק את טקסט המודעות שרצו"
        rows={8}
        disabled={isRunning}
        className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-sm placeholder:text-[var(--color-muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)] disabled:opacity-50"
      />
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={isRunning || !creativeInput.trim()}>
          {isRunning ? 'מנתח קריאייטיבים...' : 'נתח קריאייטיבים'}
        </Button>
        {isRunning && (
          <span className="text-sm text-[var(--color-muted-foreground)]">
            מעבד...
          </span>
        )}
        {status === 'success' && (
          <span className="text-sm text-green-600">הניתוח הסתיים</span>
        )}
        {status === 'failed' && (
          <span className="text-sm text-red-600">הניתוח נכשל</span>
        )}
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </form>
  )
}
