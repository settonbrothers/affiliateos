'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { createClient } from '@/lib/supabase/server'
import { OfferCreateSchema, type OfferCreateInput } from '@/lib/validations/offer'

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export async function createOffer(
  input: OfferCreateInput
): Promise<{ error: string } | void> {
  const parsed = OfferCreateSchema.safeParse(input)
  if (!parsed.success) return { error: 'Invalid offer details.' }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated.' }

  const { data, error } = await supabase
    .from('offers')
    .insert({
      name: parsed.data.name,
      slug: slugify(parsed.data.name),
      vertical_id: parsed.data.vertical_id,
      website_url: parsed.data.website_url || null,
      affiliate_program_url: parsed.data.affiliate_program_url || null,
      created_by_user_id: user.id,
      status: 'draft',
      visibility: 'admin_only',
    })
    .select('id')
    .single()
  if (error) return { error: error.message }

  revalidatePath('/offers')
  redirect(`/offers/${(data as { id: string }).id}`)
}

export type TriggerAnalyzeResult = { run_id: string } | { error: string }

export async function triggerAnalyze(
  offerId: string
): Promise<TriggerAnalyzeResult> {
  const supabase = await createClient()
  const { data, error } = await supabase.functions.invoke('analyze-offer', {
    body: { offer_id: offerId },
  })
  if (error) return { error: error.message }
  return data as { run_id: string }
}
