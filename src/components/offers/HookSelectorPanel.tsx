'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { saveSelectedHooks } from '@/lib/actions/selectedHooks'

type Hook = {
  text: string
  angle_index: number
  lang: string
  is_recommended?: boolean
}

type HookSelectorPanelProps = {
  generationId: string
  hooks: Hook[]
  initialSelectedIndices: number[] | null
}

export function HookSelectorPanel({
  generationId,
  hooks,
  initialSelectedIndices,
}: HookSelectorPanelProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  // Build initial selection: use saved indices, or auto-select recommended hooks
  const defaultIndices =
    initialSelectedIndices !== null && initialSelectedIndices.length > 0
      ? initialSelectedIndices
      : hooks.reduce<number[]>((acc, h, i) => {
          if (h.is_recommended) acc.push(i)
          return acc
        }, [])

  const [selected, setSelected] = useState<Set<number>>(new Set(defaultIndices))
  const [saved, setSaved] = useState(
    initialSelectedIndices !== null && initialSelectedIndices.length > 0
  )
  const [saveError, setSaveError] = useState<string | null>(null)

  function toggle(index: number) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(index)) {
        next.delete(index)
      } else {
        next.add(index)
      }
      return next
    })
    setSaved(false)
  }

  function handleSave() {
    setSaveError(null)
    startTransition(async () => {
      const indices = Array.from(selected).sort((a, b) => a - b)
      const result = await saveSelectedHooks(generationId, indices)
      if ('error' in result) {
        setSaveError(result.error)
      } else {
        setSaved(true)
        router.refresh()
      }
    })
  }

  // Group: Hebrew first, then English
  const heHooks = hooks.map((h, i) => ({ ...h, originalIndex: i })).filter((h) => h.lang === 'he')
  const enHooks = hooks.map((h, i) => ({ ...h, originalIndex: i })).filter((h) => h.lang === 'en')
  const grouped = [...heHooks, ...enHooks]

  const noneSelected = selected.size === 0

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        {grouped.map((hook) => {
          const idx = hook.originalIndex
          const isChecked = selected.has(idx)
          return (
            <label
              key={idx}
              className={cn(
                'flex cursor-pointer items-start gap-3 rounded-md border p-3 transition-colors',
                isChecked ? 'border-blue-400 bg-blue-50' : 'border-[#DED8CB] hover:bg-[#EFEBE1]'
              )}
              style={{ color: '#1F1B16' }}
            >
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 shrink-0 accent-blue-600"
                checked={isChecked}
                onChange={() => toggle(idx)}
              />
              <div className="flex flex-1 flex-wrap items-start gap-2">
                <span style={{ flexShrink: 0, display: 'inline-block', background: '#EFEBE1', color: '#1F1B16', fontSize: '12px', fontWeight: 500, padding: '2px 8px' }}>
                  {hook.lang.toUpperCase()}
                </span>
                <span
                  className="text-sm"
                  dir={hook.lang === 'he' ? 'rtl' : 'ltr'}
                >
                  {hook.text}
                </span>
                {hook.is_recommended && (
                  <span className="shrink-0 rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-800">
                    מומלץ
                  </span>
                )}
              </div>
            </label>
          )
        })}
      </div>

      <div className="flex items-center gap-3">
        <Button
          onClick={handleSave}
          disabled={noneSelected || isPending}
          size="sm"
        >
          {isPending ? 'שומר...' : 'שמור hooks נבחרים'}
        </Button>

        {saved && !isPending && (
          <span className="text-sm font-medium" style={{ color: '#2E6B34' }}>
            {selected.size} hooks נבחרו — Creative Engine פתוח
          </span>
        )}

        {saveError && (
          <span className="text-sm" style={{ color: '#B23A24' }}>{saveError}</span>
        )}

        {noneSelected && (
          <span className="text-sm" style={{ color: '#6B6459' }}>
            יש לבחור לפחות hook אחד
          </span>
        )}
      </div>
    </div>
  )
}
