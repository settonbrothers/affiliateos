'use client'

import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'
import { triggerGenerateAdCopy } from '@/lib/actions/adCopy'
import { createClient } from '@/lib/supabase/client'
import type { AiRunStatus } from '@/types/db'

const TERMINAL: AiRunStatus[] = ['success', 'failed', 'partial']

const COPY_TEMPLATES = [
  { value: 'AIDA', label: 'AIDA' },
  { value: 'PAS', label: 'PAS' },
  { value: 'BAB', label: 'BAB' },
  { value: 'us_vs_them', label: 'Us vs Them' },
  { value: 'story', label: 'Story' },
  { value: 'tiktok_reel', label: 'TikTok Reel' },
  { value: 'nurture', label: 'Nurture' },
  { value: 'direct_offer', label: 'Direct Offer' },
  { value: 'business', label: 'Business' },
] as const

export function ExecuteCopyButton({
  offerId,
  initialStatus,
  hasVerdict,
  hasCopy,
}: {
  offerId: string
  initialStatus: AiRunStatus | null
  hasVerdict: boolean
  hasCopy: boolean
}) {
  const router = useRouter()
  const t = useTranslations('offers')
  const [status, setStatus] = useState<AiRunStatus | 'idle'>(
    initialStatus ?? 'idle'
  )
  const [runId, setRunId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [template, setTemplate] = useState<string>('PAS')

  const isRunning = status === 'pending' || status === 'running'

  useEffect(() => {
    if (!runId || !isRunning) return
    const supabase = createClient()
    const channel = supabase
      .channel(`adcopy_run:${runId}`)
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

  async function onGenerate() {
    setError(null)
    setStatus('running')
    const result = await triggerGenerateAdCopy(offerId, template)
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
        {t('copyNeedsVerdict')}
      </p>
    )
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <div className="flex items-center gap-3">
        <select
          value={template}
          onChange={(e) => setTemplate(e.target.value)}
          disabled={isRunning}
          className="rounded-md border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-sm text-[var(--color-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)] disabled:opacity-50"
        >
          {COPY_TEMPLATES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
        <Button onClick={onGenerate} disabled={isRunning}>
          {isRunning
            ? t('generating')
            : hasCopy
              ? t('regenerateCopy')
              : t('generateCopy')}
        </Button>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  )
}
