import type { SupabaseClient } from '@supabase/supabase-js'

import { createClient } from '@/lib/supabase/server'

// The discovery_* tables (migration 0030) aren't in the generated database.ts
// until it's regenerated on main post-merge. Until then we read them through an
// untyped client and cast results to the explicit row types below. Once
// database.ts includes the tables, drop the cast and use the typed client.
async function discoveryDb(): Promise<SupabaseClient> {
  return (await createClient()) as unknown as SupabaseClient
}

export type DiscoveryRun = {
  id: string
  status: string
  vertical_id: string | null
  config: { breadth?: string } | null
  counts: {
    discovered?: number
    triaged?: number
    analyzed?: number
    approved?: number
  } | null
  total_cost_usd: number | null
  error_message: string | null
  created_at: string
  completed_at: string | null
}

export type DiscoveryCandidate = {
  id: string
  run_id: string
  name: string
  url: string | null
  domain: string | null
  raw_snippet: string | null
  stage: string
  triage_score: number | null
  triage_reason: string | null
  deep_analysis: unknown
  deep_score: number | null
  rejection_stage: string | null
  rejection_reason: string | null
  promoted_offer_id: string | null
}

export async function listDiscoveryRuns(): Promise<DiscoveryRun[]> {
  const supabase = await discoveryDb()
  const { data } = await supabase
    .from('discovery_runs')
    .select(
      'id, status, vertical_id, config, counts, total_cost_usd, error_message, created_at, completed_at'
    )
    .order('created_at', { ascending: false })
    .limit(50)
  return (data ?? []) as DiscoveryRun[]
}

export async function getDiscoveryRun(id: string): Promise<DiscoveryRun | null> {
  const supabase = await discoveryDb()
  const { data } = await supabase
    .from('discovery_runs')
    .select(
      'id, status, vertical_id, config, counts, total_cost_usd, error_message, created_at, completed_at'
    )
    .eq('id', id)
    .maybeSingle()
  return (data as DiscoveryRun | null) ?? null
}

export async function listCandidates(
  runId: string
): Promise<DiscoveryCandidate[]> {
  const supabase = await discoveryDb()
  const { data } = await supabase
    .from('discovery_candidates')
    .select(
      'id, run_id, name, url, domain, raw_snippet, stage, triage_score, triage_reason, deep_analysis, deep_score, rejection_stage, rejection_reason, promoted_offer_id'
    )
    .eq('run_id', runId)
  return (data ?? []) as DiscoveryCandidate[]
}

export type DiscoverySourceRow = {
  id: string
  kind: string
  name: string
  vertical_id: string | null
  config: { query_templates?: string[] } | null
  enabled: boolean
}

export async function listDiscoverySources(): Promise<DiscoverySourceRow[]> {
  const supabase = await discoveryDb()
  const { data } = await supabase
    .from('discovery_sources')
    .select('id, kind, name, vertical_id, config, enabled')
    .order('name')
  return (data ?? []) as DiscoverySourceRow[]
}
