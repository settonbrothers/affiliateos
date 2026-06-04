'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { isCurrentUserAdmin } from '@/lib/auth/role'
import { createClient } from '@/lib/supabase/server'
import {
  GoldenOfferSchema,
  type GoldenOfferInput,
} from '@/lib/validations/golden'
import type { Json } from '@/types/database'

// Output of JSON.parse is valid JSON by construction, so asserting Json[] is
// sound here (we already checked it's an array).
function parseFacts(
  raw: string | undefined
): { facts: Json[] } | { error: string } {
  if (!raw || !raw.trim()) return { facts: [] }
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return { error: 'Facts snapshot must be valid JSON.' }
  }
  if (!Array.isArray(parsed))
    return { error: 'Facts snapshot must be a JSON array.' }
  return { facts: parsed as Json[] }
}

export async function createGoldenOffer(
  input: GoldenOfferInput
): Promise<{ error: string } | void> {
  const parsed = GoldenOfferSchema.safeParse(input)
  if (!parsed.success) return { error: 'Invalid golden offer details.' }
  if (!(await isCurrentUserAdmin())) return { error: 'Admin only.' }

  const facts = parseFacts(parsed.data.facts_snapshot)
  if ('error' in facts) return { error: facts.error }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { error } = await supabase.from('golden_set_offers').insert({
    external_id: parsed.data.external_id || null,
    offer_name: parsed.data.offer_name,
    vertical_id: parsed.data.vertical_id,
    offer_url: parsed.data.offer_url || null,
    expected_verdict: parsed.data.expected_verdict,
    facts_snapshot: facts.facts,
    notes: parsed.data.notes || null,
    created_by: user?.id ?? null,
  })
  if (error) return { error: error.message }

  revalidatePath('/admin/eval/golden')
  redirect('/admin/eval/golden')
}

export async function deleteGoldenOffer(
  id: string
): Promise<{ error: string } | void> {
  if (!(await isCurrentUserAdmin())) return { error: 'Admin only.' }

  const supabase = await createClient()
  const { error } = await supabase
    .from('golden_set_offers')
    .delete()
    .eq('id', id)
  if (error) return { error: error.message }

  revalidatePath('/admin/eval/golden')
}
