'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useRef } from 'react'

import { ensureTranslations } from '@/lib/actions/i18n'
import type { TranslatableSource } from '@/lib/i18n/translatable'

/**
 * TranslationFiller for a list of rows.
 *
 * The discovery run page already read translated payloads but never mounted a
 * filler, so its cache was never populated and the deep analysis always
 * rendered in English regardless of locale. Mounting one filler per candidate
 * would have fixed that at the cost of up to a hundred Haiku calls and a
 * hundred router refreshes; this fills them server-side in one sequential pass
 * and refreshes once.
 */
export function TranslationBatchFiller({
  sourceTable,
  sourceIds,
  locale,
}: {
  sourceTable: TranslatableSource
  sourceIds: string[]
  locale: string
}) {
  const router = useRouter()
  const fired = useRef(false)
  // Join, so re-renders with an equivalent array don't refire.
  const key = sourceIds.join(',')

  useEffect(() => {
    if (locale === 'en' || fired.current || !key) return
    fired.current = true
    ensureTranslations(sourceTable, key.split(','), locale)
      .then((r) => {
        if (r.filled > 0) router.refresh()
      })
      .catch(() => {
        // best-effort — leave the English text in place
      })
  }, [sourceTable, key, locale, router])

  return null
}
