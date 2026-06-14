'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

import { startScan } from '@/lib/actions/discovery'
import { SCAN_BREADTHS } from '@/lib/validations/discovery'

type VerticalOption = { id: string; name: string }

export function StartScanForm({ verticals }: { verticals: VerticalOption[] }) {
  const router = useRouter()
  const [verticalId, setVerticalId] = useState(verticals[0]?.id ?? '')
  const [breadth, setBreadth] = useState<string>('standard')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-md border border-[var(--color-border)] p-4">
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-[var(--color-muted-foreground)]">Vertical</span>
        <select
          value={verticalId}
          onChange={(e) => setVerticalId(e.target.value)}
          className="rounded-md border border-[var(--color-border)] bg-transparent px-2 py-1"
        >
          {verticals.map((v) => (
            <option key={v.id} value={v.id}>
              {v.name}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-[var(--color-muted-foreground)]">Breadth</span>
        <select
          value={breadth}
          onChange={(e) => setBreadth(e.target.value)}
          className="rounded-md border border-[var(--color-border)] bg-transparent px-2 py-1"
        >
          {SCAN_BREADTHS.map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </select>
      </label>
      <button
        disabled={isPending || !verticalId}
        onClick={() =>
          startTransition(async () => {
            const res = await startScan(verticalId, breadth)
            if ('error' in res) {
              setError(res.error)
            } else {
              setError(null)
              router.push(`/admin/discovery/${res.run_id}`)
            }
          })
        }
        className="rounded-md bg-[var(--color-foreground)] px-4 py-2 text-sm text-[var(--color-background)] disabled:opacity-50"
      >
        {isPending ? 'Starting…' : 'Start scan'}
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  )
}
