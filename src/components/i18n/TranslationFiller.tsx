'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useRef } from 'react'

import { ensureTranslation } from '@/lib/actions/i18n'
import type { TranslatableSource } from '@/lib/i18n/translatable'

// Invisible helper: after the page has rendered (in English if the translation
// isn't cached yet), it asks the server to translate + cache this row, then
// refreshes so the Hebrew text appears. Fires once per mount; only refreshes
// when a NEW translation was created, so a cache hit is a cheap no-op (no
// refresh loop). Never blocks render — the AI call happens here, post-paint.
export function TranslationFiller({
  sourceTable,
  sourceId,
  locale,
}: {
  sourceTable: TranslatableSource
  sourceId: string
  locale: string
}) {
  const router = useRouter()
  const fired = useRef(false)

  useEffect(() => {
    if (locale === 'en' || fired.current) return
    fired.current = true
    ensureTranslation(sourceTable, sourceId, locale)
      .then((r) => {
        if (r.filled) router.refresh()
      })
      .catch(() => {
        // best-effort — leave the English text in place
      })
  }, [sourceTable, sourceId, locale, router])

  return null
}
