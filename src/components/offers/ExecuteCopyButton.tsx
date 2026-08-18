'use client'

import { useTranslations } from 'next-intl'
import { useState } from 'react'

import { ScanPanel } from '@/components/ai/ScanPanel'
import { Button } from '@/components/ui/button'
import { useAiRunStatus } from '@/hooks/useAiRunStatus'
import { triggerGenerateAdCopy } from '@/lib/actions/adCopy'
import type { AiRunStatus } from '@/types/db'

const COPY_TEMPLATES = [
  'AIDA',
  'PAS',
  'BAB',
  'us_vs_them',
  'story',
  'tiktok_reel',
  'nurture',
  'direct_offer',
  'business',
] as const

export function ExecuteCopyButton({
  offerId,
  initialStatus,
  initialRunId,
  hasVerdict,
  hasCopy,
}: {
  offerId: string
  initialStatus: AiRunStatus | null
  initialRunId?: string | null
  hasVerdict: boolean
  hasCopy: boolean
}) {
  const t = useTranslations('offers')
  const { setStatus, isRunning, setRunId, error, setError } = useAiRunStatus(
    initialStatus,
    initialRunId
  )
  const [creativeHint, setCreativeHint] = useState('')
  const [sourceUrls, setSourceUrls] = useState('')
  const [template, setTemplate] = useState('PAS')
  const evidenceV4Enabled =
    process.env.NEXT_PUBLIC_AD_COPY_EVIDENCE_V4_ENABLED === 'true'

  async function onGenerate() {
    setError(null)
    setStatus('running')
    const additionalSourceUrls = sourceUrls
      .split(/\r?\n/)
      .map((value) => value.trim())
      .filter(Boolean)
    const result = await triggerGenerateAdCopy(
      offerId,
      evidenceV4Enabled ? { creativeHint, additionalSourceUrls } : { template }
    )
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
      {evidenceV4Enabled ? (
        <details className="w-full max-w-xl border border-[var(--color-border)] bg-[var(--color-background)] p-3">
          <summary className="cursor-pointer text-sm font-medium text-[var(--color-foreground)]">
            {t('copyOptionalDirection')}
          </summary>
          <div className="mt-3 flex flex-col gap-3">
            <textarea
              value={creativeHint}
              onChange={(event) => setCreativeHint(event.target.value)}
              disabled={isRunning}
              maxLength={2000}
              rows={3}
              placeholder={t('copyCreativeHintPlaceholder')}
              className="w-full rounded-none border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-sm text-[var(--color-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)] disabled:opacity-50"
            />
            <textarea
              value={sourceUrls}
              onChange={(event) => setSourceUrls(event.target.value)}
              disabled={isRunning}
              rows={2}
              placeholder={t('copySourceUrlsPlaceholder')}
              className="w-full rounded-none border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-sm text-[var(--color-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)] disabled:opacity-50"
            />
          </div>
        </details>
      ) : (
        <select
          value={template}
          onChange={(event) => setTemplate(event.target.value)}
          disabled={isRunning}
          className="rounded-none border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-sm text-[var(--color-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)] disabled:opacity-50"
        >
          {COPY_TEMPLATES.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
      )}
      <div className="flex items-center gap-3">
        <Button onClick={onGenerate} disabled={isRunning}>
          {isRunning
            ? t('generating')
            : hasCopy
              ? t('regenerateCopy')
              : t('generateCopy')}
        </Button>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {isRunning && (
        <ScanPanel
          title="AD COPY"
          steps={
            evidenceV4Enabled
              ? [
                  'researching evidence',
                  'choosing the strongest form',
                  'writing in Hebrew',
                  'running independent gates',
                ]
              : [
                  'reading the verdict',
                  'drafting hooks',
                  'writing variants',
                  'running the judge',
                ]
          }
        />
      )}
    </div>
  )
}
