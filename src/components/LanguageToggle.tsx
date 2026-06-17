'use client'

import { useLocale, useTranslations } from 'next-intl'
import { useTransition } from 'react'

import { setLocale } from '@/lib/actions/locale'

// Flips between Hebrew and English; the label shows the OTHER language (the one
// you'd switch to). Choice persists via the `locale` cookie.
export function LanguageToggle() {
  const locale = useLocale()
  const t = useTranslations('nav')
  const [isPending, startTransition] = useTransition()
  const next = locale === 'he' ? 'en' : 'he'

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() => startTransition(() => setLocale(next))}
      className="rounded-md border border-[var(--color-border)] px-3 py-2 text-sm hover:bg-[var(--color-muted)] disabled:opacity-50"
    >
      {t('language')}
    </button>
  )
}
