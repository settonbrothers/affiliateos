import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'

import { DEFAULT_LOCALE } from '@/i18n/locale'
import { applyTranslations, collectStrings } from '@/lib/i18n/translatable'
import { createClient } from '@/lib/supabase/server'

// content_translations isn't in the generated database.ts until regen on main.
// Bridge to an untyped client for that table only; drop after regen.
type UntypedClient = SupabaseClient

// Tables whose displayed jsonb payload can be shown translated. Mirrors the
// edge function's SOURCE_PAYLOAD_COLUMN allow-list.
export type TranslatableSource =
  | 'ai_runs'
  | 'discovery_candidates'
  | 'test_kits'
  | 'offer_compliance_warnings'
  | 'result_diagnoses'

// Return the AI payload with its free-text fields shown in `locale`, falling
// back to the canonical English payload whenever a translation is missing or
// fails. The English payload (the eval/judge source of truth) is never mutated.
//
// On a cache hit we merge the cached translation. On a miss (and only when
// there is prose worth translating) we ask the translate-content edge function,
// which translates + caches and returns the lookup, so the first view fills the
// cache and every later view is a cheap DB read. Best-effort throughout.
export async function getTranslatedPayload(
  sourceTable: TranslatableSource,
  sourceId: string,
  locale: string,
  englishPayload: unknown
): Promise<unknown> {
  if (englishPayload == null || typeof englishPayload !== 'object') {
    return englishPayload
  }
  if (locale === DEFAULT_LOCALE) return englishPayload

  const supabase = (await createClient()) as unknown as UntypedClient

  const { data: cached } = await supabase
    .from('content_translations')
    .select('payload')
    .eq('source_table', sourceTable)
    .eq('source_id', sourceId)
    .eq('locale', locale)
    .maybeSingle()

  const cachedLookup = (cached as { payload?: unknown } | null)?.payload
  if (cachedLookup && typeof cachedLookup === 'object') {
    return applyTranslations(
      englishPayload,
      cachedLookup as Record<string, string>
    )
  }

  // Nothing cached. Skip the round trip when there's no prose to translate.
  if (collectStrings(englishPayload).length === 0) return englishPayload

  try {
    const { data, error } = await supabase.functions.invoke('translate-content', {
      body: { source_table: sourceTable, source_id: sourceId, locale },
    })
    if (error) return englishPayload
    const lookup = (data as { payload?: unknown } | null)?.payload
    if (lookup && typeof lookup === 'object') {
      return applyTranslations(englishPayload, lookup as Record<string, string>)
    }
  } catch {
    // Degrade open — show English rather than block the page.
  }
  return englishPayload
}
