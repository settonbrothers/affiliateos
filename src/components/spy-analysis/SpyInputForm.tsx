'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import { triggerSpyAnalysis } from '@/lib/actions/spyAnalysis'
import { createClient } from '@/lib/supabase/client'
import type { AiRunStatus } from '@/types/db'

const TERMINAL: AiRunStatus[] = ['success', 'failed', 'partial']

type InputTab = 'text' | 'url' | 'batch'

const TAB_LABELS: Record<InputTab, string> = {
  text: 'Paste Text',
  url: 'Enter URL',
  batch: 'Batch (multiple)',
}

const PLACEHOLDERS: Record<InputTab, string> = {
  text: 'Paste ad copy or landing page text here…',
  url: 'https://example.com/landing-page',
  batch: 'Paste multiple ads or landing pages here, separated by "---"…',
}

export function SpyInputForm({
  offerId,
  hasExistingAnalysis,
}: {
  offerId: string
  hasExistingAnalysis: boolean
}) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<InputTab>('text')
  const [textInput, setTextInput] = useState('')
  const [urlInput, setUrlInput] = useState('')
  const [batchInput, setBatchInput] = useState('')
  const [status, setStatus] = useState<AiRunStatus | 'idle'>('idle')
  const [runId, setRunId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const isRunning = status === 'pending' || status === 'running'
  const statusRef = useRef(status)
  useEffect(() => { statusRef.current = status }, [status])

  useEffect(() => {
    if (!runId || !isRunning) return
    const supabase = createClient()
    const channel = supabase
      .channel(`spy_analysis_run:${runId}`)
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
      .subscribe((subscribeStatus) => {
        if (subscribeStatus === 'CHANNEL_ERROR' || subscribeStatus === 'TIMED_OUT') {
          setStatus('failed')
          setError('Connection lost. Please refresh and try again.')
        }
      })

    const timeout = setTimeout(() => {
      if (statusRef.current === 'running' || statusRef.current === 'pending') {
        setStatus('failed')
        setError('Timed out. The generation may still be running — refresh to check.')
        void supabase.removeChannel(channel)
      }
    }, 90_000)

    return () => {
      clearTimeout(timeout)
      void supabase.removeChannel(channel)
    }
  }, [runId, isRunning, router])

  async function onSubmit() {
    setError(null)

    const rawInput =
      activeTab === 'text'
        ? textInput.trim()
        : activeTab === 'url'
          ? urlInput.trim()
          : batchInput.trim()

    if (!rawInput) {
      setError('Please provide input before submitting.')
      return
    }

    setStatus('running')
    const result = await triggerSpyAnalysis(offerId, activeTab, rawInput)
    if ('error' in result) {
      setError(result.error)
      setStatus('idle')
      return
    }
    setRunId(result.run_id)
  }

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-[var(--color-border)] p-4">
      <h2 className="text-sm font-semibold">
        {hasExistingAnalysis ? 'Run new Spy Analysis' : 'Spy Analysis'}
      </h2>

      {/* Tab selector */}
      <div className="flex gap-1 border-b border-[var(--color-border)]">
        {(Object.keys(TAB_LABELS) as InputTab[]).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={`px-3 py-1.5 text-sm transition-colors ${
              activeTab === tab
                ? 'border-b-2 border-[var(--color-foreground)] font-medium'
                : 'text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]'
            }`}
          >
            {TAB_LABELS[tab]}
          </button>
        ))}
      </div>

      {/* Input area */}
      {activeTab === 'url' ? (
        <input
          type="url"
          value={urlInput}
          onChange={(e) => setUrlInput(e.target.value)}
          placeholder={PLACEHOLDERS.url}
          disabled={isRunning}
          className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-sm placeholder:text-[var(--color-muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)] disabled:opacity-50"
        />
      ) : (
        <textarea
          value={activeTab === 'text' ? textInput : batchInput}
          onChange={(e) =>
            activeTab === 'text'
              ? setTextInput(e.target.value)
              : setBatchInput(e.target.value)
          }
          placeholder={PLACEHOLDERS[activeTab]}
          disabled={isRunning}
          rows={6}
          className="w-full resize-y rounded-md border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-sm placeholder:text-[var(--color-muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)] disabled:opacity-50"
        />
      )}

      <div className="flex flex-col items-start gap-1">
        <Button onClick={onSubmit} disabled={isRunning}>
          {isRunning ? 'Analyzing…' : hasExistingAnalysis ? 'Re-analyze' : 'Analyze'}
        </Button>
        {error && <p className="text-sm text-red-600">{error}</p>}
        {status === 'failed' && (
          <p className="text-sm text-red-600">Analysis failed. Please try again.</p>
        )}
      </div>
    </div>
  )
}
