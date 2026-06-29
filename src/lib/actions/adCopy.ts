'use server'

import { createClient } from '@/lib/supabase/server'

export type TriggerGenerateAdCopyResult = { run_id: string } | { error: string }

export async function triggerGenerateAdCopy(
  offerId: string
): Promise<TriggerGenerateAdCopyResult> {
  const supabase = await createClient()
  const { data, error } = await supabase.functions.invoke('generate-ad-copy', {
    body: { offer_id: offerId },
  })
  if (error) return { error: error.message }
  return data as { run_id: string }
}

export type SaveCopyEditInput = {
  generationId: string
  variantLang: 'he' | 'en'
  variantIndex: number
  originalText: string
  editedText: string
  rating: 'good' | 'bad'
  reason?: string | null
}

export type SaveCopyEditResult = { ok: true } | { error: string }

// Persists one Edit-Loop signal: the (original -> edited) pair into ad_copy_edits,
// AND a Taste Corpus row so future generations few-shot on it and the judge can
// calibrate against it. This is the flywheel — labels come from real in-system use.
export async function triggerSaveCopyEdit(
  input: SaveCopyEditInput
): Promise<SaveCopyEditResult> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  // Scope the new rows to the generation's offer + workspace.
  const { data: gen, error: genErr } = await supabase
    .from('ad_copy_generations')
    .select('id, offer_id, workspace_id')
    .eq('id', input.generationId)
    .maybeSingle()
  if (genErr || !gen) return { error: 'Generation not found' }

  const { error: editErr } = await supabase.from('ad_copy_edits').insert({
    generation_id: input.generationId,
    workspace_id: gen.workspace_id,
    edited_by_user_id: user.id,
    variant_lang: input.variantLang,
    variant_index: input.variantIndex,
    original_text: input.originalText,
    edited_text: input.editedText,
    rating: input.rating,
    reason: input.reason ?? null,
  })
  if (editErr) return { error: editErr.message }

  // Learning signal for the corpus: a 'bad' rating stores the original as the bad
  // example with the edit as its improvement; a 'good' rating stores the kept text.
  const isBad = input.rating === 'bad'
  const { error: corpusErr } = await supabase.from('copy_taste_examples').insert({
    kind: 'copy',
    lang: input.variantLang,
    text: isBad ? input.originalText : input.editedText,
    improved_text: isBad ? input.editedText : null,
    label: input.rating,
    reason: input.reason ?? null,
    source: 'edit_loop',
    workspace_id: gen.workspace_id,
    offer_id: gen.offer_id,
    created_by_user_id: user.id,
  })
  if (corpusErr) return { error: corpusErr.message }

  return { ok: true }
}
