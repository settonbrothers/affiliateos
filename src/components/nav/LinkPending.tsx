'use client'

import { useLinkStatus } from 'next/link'

// A small pulsing dot that appears while the parent <Link>'s navigation is
// pending. Must be rendered as a descendant of a next/link <Link>.
export function LinkPending() {
  const { pending } = useLinkStatus()
  if (!pending) return null
  return (
    <span
      aria-hidden
      style={{
        width: 6,
        height: 6,
        borderRadius: '50%',
        background: 'var(--primary)',
        marginInlineStart: 7,
        animation: 'affexPulseDot 0.7s ease-in-out infinite',
      }}
    />
  )
}
