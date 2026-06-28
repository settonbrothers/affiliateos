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
