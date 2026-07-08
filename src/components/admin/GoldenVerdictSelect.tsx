'use client'

import { useState, useTransition } from 'react'

import { updateGoldenVerdict } from '@/lib/actions/golden'
import { VERDICTS } from '@/types/agents/underwriting'

const SELECT_CLASS =
  'h-9 rounded-none border border-[var(--color-border)] bg-[var(--color-background)] px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]'

export function GoldenVerdictSelect({
  id,
  value,
}: {
  id: string
  value: string
}) {
  const [verdict, setVerdict] = useState(value)
  const [isPending, startTransition] = useTransition()
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function onChange(next: string) {
    const prev = verdict
    setVerdict(next)
    setSaved(false)
    setError(null)
    startTransition(async () => {
      const result = await updateGoldenVerdict(id, next)
      if (result && 'error' in result) {
        setError(result.error)
        setVerdict(prev)
      } else {
        setSaved(true)
      }
    })
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <select
        aria-label="Expected verdict"
        className={SELECT_CLASS}
        value={verdict}
        disabled={isPending}
        onChange={(e) => onChange(e.target.value)}
      >
        {VERDICTS.map((v) => (
          <option key={v} value={v}>
            {v}
          </option>
        ))}
      </select>
      {isPending ? (
        <span className="text-xs text-[var(--color-muted-foreground)]">Saving…</span>
      ) : error ? (
        <span className="text-xs text-red-600">{error}</span>
      ) : saved ? (
        <span className="text-xs text-green-600">Saved</span>
      ) : null}
    </div>
  )
}
