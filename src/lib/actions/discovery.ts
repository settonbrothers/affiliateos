'use server'

import type { SupabaseClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'

import { isCurrentUserAdmin } from '@/lib/auth/role'
import { createClient } from '@/lib/supabase/server'
import {
  DiscoverySourceSchema,
  StartScanSchema,
} from '@/lib/validations/discovery'

// discovery_* tables aren't in the generated database.ts until regen on main.
// Bridge to an untyped client for those tables only; drop after regen.
type UntypedClient = SupabaseClient

export type StartScanResult = { run_id: string } | { error: string }

export async function startScan(
  verticalId: string,
  breadth: string
): Promise<StartScanResult> {
  if (!(await isCurrentUserAdmin())) return { error: 'Admin only.' }
  const parsed = StartScanSchema.safeParse({ vertical_id: verticalId, breadth })
  if (!parsed.success) return { error: 'Invalid scan settings.' }

  const supabase = await createClient()
  const { data, error } = await supabase.functions.invoke('discover-offers', {
    body: { vertical_id: parsed.data.vertical_id, breadth: parsed.data.breadth },
  })
  if (error) return { error: error.message }
  revalidatePath('/admin/discovery')
  return data as { run_id: string }
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

// Approve a candidate → create a real, admin-visible offer (status 'published')
// linked back from the candidate, so it shows up in the offers list and can be
// analyzed/published like any offer.
export async function approveCandidate(
  candidateId: string
): Promise<{ error: string } | void> {
  if (!(await isCurrentUserAdmin())) return { error: 'Admin only.' }

  const supabase = await createClient()
  const ddb = supabase as unknown as UntypedClient
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated.' }

  const { data: cand } = await ddb
    .from('discovery_candidates')
    .select('id, name, url, vertical_id, deep_analysis, promoted_offer_id')
    .eq('id', candidateId)
    .maybeSingle()
  if (!cand) return { error: 'Candidate not found.' }
  if ((cand as { promoted_offer_id: string | null }).promoted_offer_id) {
    return { error: 'Already promoted.' }
  }

  const { data: membership } = await supabase
    .from('workspace_members')
    .select('workspace_id')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle()

  const name = (cand as { name: string }).name
  const verticalId = (cand as { vertical_id: string | null }).vertical_id
  if (!verticalId) return { error: 'Candidate has no vertical.' }

  const { data: offer, error: oErr } = await supabase
    .from('offers')
    .insert({
      name,
      slug: `${slugify(name)}-${candidateId.slice(0, 8)}`,
      vertical_id: verticalId,
      website_url: (cand as { url: string | null }).url,
      created_by_user_id: user.id,
      workspace_id: membership?.workspace_id ?? null,
      status: 'published',
      visibility: 'admin_only',
      operator_notes: 'Approved from Discovery Scanner.',
    })
    .select('id')
    .single()
  if (oErr) return { error: oErr.message }
  const offerId = (offer as { id: string }).id

  await ddb
    .from('discovery_candidates')
    .update({ stage: 'promoted', promoted_offer_id: offerId })
    .eq('id', candidateId)

  revalidatePath('/admin/discovery')
  revalidatePath('/offers')
}

export async function rejectCandidate(
  candidateId: string
): Promise<{ error: string } | void> {
  if (!(await isCurrentUserAdmin())) return { error: 'Admin only.' }
  const supabase = await createClient()
  const ddb = supabase as unknown as UntypedClient
  const { error } = await ddb
    .from('discovery_candidates')
    .update({
      stage: 'rejected',
      rejection_stage: 'analyzed',
      rejection_reason: 'Rejected by admin during review.',
    })
    .eq('id', candidateId)
  if (error) return { error: error.message }
  revalidatePath('/admin/discovery')
}

export async function saveDiscoverySource(
  input: unknown
): Promise<{ error: string } | void> {
  if (!(await isCurrentUserAdmin())) return { error: 'Admin only.' }
  const parsed = DiscoverySourceSchema.safeParse(input)
  if (!parsed.success) return { error: 'Invalid source.' }

  const supabase = await createClient()
  const ddb = supabase as unknown as UntypedClient
  const { error } = await ddb.from('discovery_sources').insert({
    name: parsed.data.name,
    kind: parsed.data.kind,
    vertical_id: parsed.data.vertical_id || null,
    config: { query_templates: parsed.data.query_templates ?? [] },
    enabled: parsed.data.enabled,
  })
  if (error) return { error: error.message }
  revalidatePath('/admin/discovery/sources')
}

export async function setSourceEnabled(
  sourceId: string,
  enabled: boolean
): Promise<{ error: string } | void> {
  if (!(await isCurrentUserAdmin())) return { error: 'Admin only.' }
  const supabase = await createClient()
  const ddb = supabase as unknown as UntypedClient
  const { error } = await ddb
    .from('discovery_sources')
    .update({ enabled })
    .eq('id', sourceId)
  if (error) return { error: error.message }
  revalidatePath('/admin/discovery/sources')
}
