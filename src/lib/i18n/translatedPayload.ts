import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'

import { DEFAULT_LOCALE } from '@/i18n/locale'
import { applyTranslations } from '@/lib/i18n/translatable'
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
// back to the canonical English payload whenever no translation is cached yet.
//
// READ-ONLY and fast: this is called during server render, so it must NEVER do
// a blocking AI/network call. It only reads the translation cache. Filling the
// cache (the actual Haiku translation) happens out-of-band via the
// TranslationFiller client component + ensureTranslation action, so the page is
// never blocked waiting on a translation. Degrades open to English on anything.
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

  try {
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
  } catch {
    // Degrade open — never block or break the page on a translation lookup.
  }
  return englishPayload
}
