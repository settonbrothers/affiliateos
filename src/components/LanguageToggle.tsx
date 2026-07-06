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
        fontSize: '10px',
        fontWeight: 600,
        letterSpacing: '0.05em',
        color: 'var(--muted-foreground)',
        background: 'transparent',
        border: 'none',
        cursor: 'pointer',
        padding: '4px 6px',
        borderRadius: '4px',
        opacity: isPending ? 0.5 : 1,
        transition: 'var(--transition)',
      }}
    >
      {label}
    </button>
  )
}
