'use server'

import type { SupabaseClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'

import { triggerIngestSource } from '@/lib/actions/sources'
import { isCurrentUserAdmin } from '@/lib/auth/role'
import {
  buildOperatorNotes,
  deepAnalysisToFacts,
  parseStoredDeepAnalysis,
} from '@/lib/discovery/promote'
import {
  writeNetworkData,
  writePromotedEvidence,
} from '@/lib/discovery/promoteWrites'
import { createClient } from '@/lib/supabase/server'
import {
  DiscoverySourceSchema,
  StartScanSchema,
} from '@/lib/validations/discovery'
import {
  NetworkComparisonSchema,
  trendingScore,
} from '@/types/agents/discoverNetwork'

// The discovery_* tables and the columns added by migrations 0039/0043
// (offers.trending_*, offers.discovery_candidate_id,
// discovery_candidates.network_analysis) aren't in the generated database.ts
// until it's regenerated on main. Bridge to an untyped client for those writes;
// drop after regen.
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

// Approve a candidate -> create a real offer that CARRIES the deep analysis.
//
// This used to select `deep_analysis` and never read it: the offer was created
// from the name/url/vertical alone, with no sources and no facts. Underwriting
// then scored 13 dimensions from the offer name, and its own hard rules capped
// the verdict at 'watch' for want of the 5 verified facts nobody had supplied.
// Now the analysis is folded into source_documents + extracted_facts (see
// src/lib/discovery/promote.ts), the qualitative read lands in operator_notes,
// and the offer's own page is queued for real extraction on top.
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
    .select(
      'id, name, url, vertical_id, deep_analysis, network_analysis, promoted_offer_id'
    )
    .eq('id', candidateId)
    .maybeSingle()
  if (!cand) return { error: 'Candidate not found.' }
  const candidate = cand as {
    name: string
    url: string | null
    vertical_id: string | null
    deep_analysis: unknown
    network_analysis: unknown
    promoted_offer_id: string | null
  }
  if (candidate.promoted_offer_id) {
    return { error: 'Already promoted.' }
  }
  if (!candidate.vertical_id) return { error: 'Candidate has no vertical.' }

  const { data: membership } = await supabase
    .from('workspace_members')
    .select('workspace_id')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle()

  const deep = parseStoredDeepAnalysis(candidate.deep_analysis)
  const { sources, facts } = deepAnalysisToFacts(deep, candidate.url)
  const notes = buildOperatorNotes(deep) || 'Approved from Discovery Scanner.'

  const { data: offer, error: oErr } = await ddb
    .from('offers')
    .insert({
      name: candidate.name,
      slug: `${slugify(candidate.name)}-${candidateId.slice(0, 8)}`,
      vertical_id: candidate.vertical_id,
      website_url: candidate.url,
      created_by_user_id: user.id,
      workspace_id: membership?.workspace_id ?? null,
      // 'published' sits AFTER 'ai_analyzed' in the offer_status enum, and both
      // ingest-source and analyze-offer advance the status through a .in()
      // guard that never demotes — so a discovered offer used to skip the whole
      // ladder and never show that it had been analyzed. Start at the bottom.
      status: 'needs_source_ingestion',
      visibility: 'admin_only',
      operator_notes: notes,
      discovery_candidate_id: candidateId,
    })
    .select('id')
    .single()
  if (oErr) return { error: oErr.message }
  const offerId = (offer as { id: string }).id

  await writePromotedEvidence(ddb, offerId, sources, facts)
  await writeNetworkData(ddb, offerId, candidate.network_analysis)

  await ddb
    .from('discovery_candidates')
    .update({ stage: 'promoted', promoted_offer_id: offerId })
    .eq('id', candidateId)

  // Real extraction on top of the carried-over analysis: the deep read is a
  // summary, ingest-source quotes the page verbatim. Runs in the background and
  // must never fail the approval — the offer already has usable evidence.
  if (candidate.url) {
    try {
      await triggerIngestSource(offerId, candidate.url)
    } catch {
      // surfaced on the offer's sources page, not here
    }
  }

  revalidatePath('/admin/discovery')
  revalidatePath('/offers')
}

export async function rejectCandidate(
  candidateId: string
): Promise<{ error: string } | void> {
  if (!(await isCurrentUserAdmin())) return { error: 'Admin only.' }
  const supabase = await createClient()
  const ddb = supabase as unknown as UntypedClient

  // rejection_stage records HOW FAR the candidate got before being dropped —
  // it feeds the funnel attribution. Reject is offered from both 'triaged' and
  // 'analyzed', so read the real stage instead of assuming 'analyzed'.
  const { data: cand } = await ddb
    .from('discovery_candidates')
    .select('stage, promoted_offer_id')
    .eq('id', candidateId)
    .maybeSingle()
  if (!cand) return { error: 'Candidate not found.' }
  if ((cand as { promoted_offer_id: string | null }).promoted_offer_id) {
    // Rejecting a promoted candidate would orphan the offer it created and
    // double-count it in the funnel. Delete the offer instead.
    return { error: 'Already promoted to an offer.' }
  }
  const stage = (cand as { stage?: string }).stage
  const reachedStage =
    stage === 'triaged' || stage === 'analyzed' ? stage : 'analyzed'

  const { error } = await ddb
    .from('discovery_candidates')
    .update({
      stage: 'rejected',
      rejection_stage: reachedStage,
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
