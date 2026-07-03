'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { isCurrentUserAdmin } from '@/lib/auth/role'
import { createClient } from '@/lib/supabase/server'
import {
  OfferCreateSchema,
  OfferStatusUpdateSchema,
  OfferUpdateSchema,
  type OfferCreateInput,
  type OfferUpdateInput,
} from '@/lib/validations/offer'

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

  // Scope the offer to the creator's workspace (1 user : 1 workspace in MVP).
  // Without this, workspace_id stays NULL and the daily-USD-cap guard — which
  // is keyed on workspace_id — never fires. Provisioned by the signup trigger
  // (migration 0021); falls back to NULL defensively if membership is missing.
  const { data: membership } = await supabase
    .from('workspace_members')
    .select('workspace_id')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle()

  const { data, error } = await supabase
    .from('offers')
    .insert({
      name: parsed.data.name,
      slug: slugify(parsed.data.name),
      vertical_id: parsed.data.vertical_id,
      website_url: parsed.data.website_url || null,
      affiliate_program_url: parsed.data.affiliate_program_url || null,
      operator_notes: parsed.data.operator_notes || null,
      created_by_user_id: user.id,
      workspace_id: membership?.workspace_id ?? null,
      // Lifecycle: needs_source_ingestion → ready_for_analysis (ingest) →
      // ai_analyzed (underwriting) → published (admin). 'draft' is reserved
      // for rows that aren't ready to enter the pipeline (e.g. promoted
      // golden-set entries an admin is still editing).
      status: 'needs_source_ingestion',
      visibility: 'admin_only',
    })
    .select('id')
    .single()
  if (error) return { error: error.message }

  revalidatePath('/offers')
  redirect(`/offers/${(data as { id: string }).id}`)
}

export async function updateOffer(
  offerId: string,
  input: OfferUpdateInput
): Promise<{ error: string } | void> {
  const parsed = OfferUpdateSchema.safeParse(input)
  if (!parsed.success) return { error: 'Invalid offer details.' }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated.' }

  // Authorize: user must own the offer (via workspace membership) or be admin.
  const { data: offer } = await supabase
    .from('offers')
    .select('workspace_id, created_by_user_id')
    .eq('id', offerId)
    .maybeSingle()
  if (!offer) return { error: 'Offer not found.' }

  const isAdmin = await isCurrentUserAdmin()
  if (!isAdmin) {
    if (!offer.workspace_id) return { error: 'Unauthorized.' }
    const { data: membership } = await supabase
      .from('workspace_members')
      .select('workspace_id')
      .eq('user_id', user.id)
      .eq('workspace_id', offer.workspace_id)
      .maybeSingle()
    if (!membership) return { error: 'Unauthorized.' }
  }

  const { error } = await supabase
    .from('offers')
    .update({
      name: parsed.data.name,
      vertical_id: parsed.data.vertical_id,
      website_url: parsed.data.website_url || null,
      affiliate_program_url: parsed.data.affiliate_program_url || null,
      operator_notes: parsed.data.operator_notes || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', offerId)
  if (error) return { error: error.message }

  revalidatePath('/offers')
  revalidatePath(`/offers/${offerId}`)
  redirect(`/offers/${offerId}`)
}

export async function deleteOffer(
  offerId: string
): Promise<{ error: string } | void> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated.' }

  // Authorize: user must own the offer (via workspace membership) or be admin.
  const { data: offer } = await supabase
    .from('offers')
    .select('workspace_id, created_by_user_id')
    .eq('id', offerId)
    .maybeSingle()
  if (!offer) return { error: 'Offer not found.' }

  const isAdmin = await isCurrentUserAdmin()
  if (!isAdmin) {
    if (!offer.workspace_id) return { error: 'Unauthorized.' }
    const { data: membership } = await supabase
      .from('workspace_members')
      .select('workspace_id')
      .eq('user_id', user.id)
      .eq('workspace_id', offer.workspace_id)
      .maybeSingle()
    if (!membership) return { error: 'Unauthorized.' }
  }

  const { error } = await supabase.from('offers').delete().eq('id', offerId)
  if (error) return { error: error.message }

  revalidatePath('/offers')
  redirect('/offers')
}

// Admin-only manual override of the lifecycle status (publish/reject/etc.).
// RLS ("admin write offers") enforces this server-side too — the explicit
// check exists to return a clear error instead of a silent 0-row update.
export async function updateOfferStatus(
  offerId: string,
  status: string
): Promise<{ error: string } | void> {
  const parsed = OfferStatusUpdateSchema.safeParse({ status })
  if (!parsed.success) return { error: 'Invalid status.' }
  if (!(await isCurrentUserAdmin())) return { error: 'Admins only.' }

  const supabase = await createClient()
  const { error } = await supabase
    .from('offers')
    .update({
      status: parsed.data.status,
      updated_at: new Date().toISOString(),
    })
    .eq('id', offerId)
  if (error) return { error: error.message }

  revalidatePath('/offers')
  revalidatePath(`/offers/${offerId}`)
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
  if (!data?.run_id) return { error: 'Unexpected response from server' }
  return data as { run_id: string }
}
