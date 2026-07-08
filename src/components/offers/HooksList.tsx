'use client'

import { useState } from 'react'

type Hook = { lang: string; text: string; is_recommended?: boolean }

export function HooksList({ hooks }: { hooks: Hook[] }) {
  const [items, setItems] = useState<Hook[]>(hooks)
  const [dragIndex, setDragIndex] = useState<number | null>(null)

  function onDragStart(i: number) {
    setDragIndex(i)
  }
  function onDragOver(e: React.DragEvent, i: number) {
    e.preventDefault()
    if (dragIndex === null || dragIndex === i) return
    const reordered = [...items]
    const spliced = reordered.splice(dragIndex, 1)
    if (!spliced[0]) return
    reordered.splice(i, 0, spliced[0])
    setDragIndex(i)
    setItems(reordered)
  }
  function onDragEnd() {
    setDragIndex(null)
  }

  return (
    <ol className="flex flex-col gap-2">
      {items.map((h, i) => (
        <li
          key={h.lang + '-' + h.text.slice(0, 20) + '-' + i}
          draggable
          onDragStart={() => onDragStart(i)}
          onDragOver={(e) => onDragOver(e, i)}
          onDragEnd={onDragEnd}
          className={`flex items-start gap-2 text-sm cursor-grab active:cursor-grabbing p-1 transition-opacity ${dragIndex === i ? 'opacity-50' : ''}`}
          style={{ color: '#1F1B16' }}
        >
          <span className="mt-0.5 select-none" style={{ color: '#8A8375' }}>⠿</span>
          <span style={{ display: 'inline-block', background: '#EFEBE1', color: '#1F1B16', fontSize: '12px', fontWeight: 500, padding: '2px 8px' }}>
            {h.lang.toUpperCase()}
          </span>
          <span>{h.text}</span>
          {h.is_recommended && (
            <span className="shrink-0 rounded-none bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-800">
              ⭐ מומלץ
            </span>
          )}
        </li>
      ))}
    </ol>
  )
}
