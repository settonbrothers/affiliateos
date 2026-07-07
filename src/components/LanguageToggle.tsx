'use client'

import { useLocale } from 'next-intl'
import { useTransition } from 'react'

import { setLocale } from '@/lib/actions/locale'

export function LanguageToggle() {
  const locale = useLocale()
  const [isPending, startTransition] = useTransition()
  const next = locale === 'he' ? 'en' : 'he'
  const label = locale === 'he' ? 'EN' : 'עב'

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() => startTransition(() => setLocale(next))}
      style={{
        fontFamily: 'var(--font-mono)',
        fontSize: '10.5px',
        color: 'var(--muted-foreground)',
        background: 'transparent',
        border: '1px solid rgba(255,255,255,0.16)',
        cursor: 'pointer',
        padding: '3px 8px',
        opacity: isPending ? 0.5 : 1,
        transition: 'var(--transition)',
      }}
    >
      {label}
    </button>
  )
}
