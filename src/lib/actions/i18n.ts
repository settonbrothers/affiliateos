'use server'

import { createClient } from '@/lib/supabase/server'
import type { TranslatableSource } from '@/lib/i18n/translatable'

// Ensure a (row, locale) translation exists in the cache, by asking the
// translate-content edge function to translate + cache it. Called from the
// client (TranslationFiller) AFTER the page has rendered, so the Haiku call
// never blocks a server render. Returns whether a NEW translation was created
// (so the caller can refresh to show it); a no-op/error returns false.
export async function ensureTranslation(
  sourceTable: TranslatableSource,
  sourceId: string,
  locale: string
): Promise<{ filled: boolean }> {
  if (locale === 'en') return { filled: false }
  try {
    const supabase = await createClient()
    const { data, error } = await supabase.functions.invoke('translate-content', {
      body: { source_table: sourceTable, source_id: sourceId, locale },
    })
    if (error) return { filled: false }
    // The edge fn returns { cached: boolean, payload }. cached === false means
    // it just created the translation → the page should refresh to show it.
    const cached = (data as { cached?: boolean } | null)?.cached
    return { filled: cached === false }
  } catch {
    return { filled: false }
  }
}

// How many rows one batch call will translate. A discovery run can hold 100
// analysed candidates; translating all of them on first view would fire 100
// Haiku calls. The cap keeps a page view bounded — the rest stay in English,
// which getTranslatedPayload already falls back to cleanly.
const MAX_BATCH_TRANSLATIONS = 12

/**
 * Batch variant for pages that render many translatable rows at once.
 *
 * Sequential on purpose: the point is to bound cost and rate-limit exposure,
 * which firing them in parallel would defeat. Returns how many were newly
 * created, so the caller refreshes once instead of once per row.
 */
export async function ensureTranslations(
  sourceTable: TranslatableSource,
  sourceIds: string[],
  locale: string
): Promise<{ filled: number }> {
  if (locale === 'en') return { filled: 0 }
  let filled = 0
  for (const id of sourceIds.slice(0, MAX_BATCH_TRANSLATIONS)) {
    const r = await ensureTranslation(sourceTable, id, locale)
    if (r.filled) filled++
  }
  return { filled }
}
