import { createClient } from '@/lib/supabase/server'
import type { AiRun, Offer, Vertical } from '@/types/db'

export async function listVerticals(): Promise<Vertical[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('verticals')
    .select('*')
    .order('display_order')
  return (data ?? []) as Vertical[]
}

export async function listOffers(): Promise<Offer[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('offers')
    .select('*')
    .order('created_at', { ascending: false })
  return (data ?? []) as Offer[]
}

export async function getOfferById(id: string): Promise<Offer | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('offers')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  return (data as Offer | null) ?? null
}

export async function getLatestRun(offerId: string): Promise<AiRun | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('ai_runs')
    .select('*')
    .eq('offer_id', offerId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  return (data as AiRun | null) ?? null
}

export async function getLatestRunByOrchestrator(
  offerId: string,
  orchestratorName: string
): Promise<AiRun | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('ai_runs')
    .select('*')
    .eq('offer_id', offerId)
    .eq('orchestrator_name', orchestratorName)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  return (data as AiRun | null) ?? null
}

export type LatestTestKit = {
  id: string
  payload: unknown
  created_at: string
} | null

export async function getLatestTestKit(offerId: string): Promise<LatestTestKit> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('test_kits')
    .select('id, payload, created_at')
    .eq('offer_id', offerId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  return (data as LatestTestKit) ?? null
}

export type LatestAdCopy = {
  id: string
  payload: unknown
  created_at: string
} | null

export async function getLatestAdCopy(offerId: string): Promise<LatestAdCopy> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('ad_copy_generations')
    .select('id, payload, created_at')
    .eq('offer_id', offerId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  return (data as LatestAdCopy) ?? null
}

export type LatestCompliance = {
  id: string
  overall_risk_level: string
  compliance_score: number | null
  suggested_verdict_cap: string | null
  payload: unknown
  created_at: string
} | null

export async function getLatestCompliance(
  offerId: string
): Promise<LatestCompliance> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('offer_compliance_warnings')
    .select(
      'id, overall_risk_level, compliance_score, suggested_verdict_cap, payload, created_at'
    )
    .eq('offer_id', offerId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  return (data as LatestCompliance) ?? null
}

export type VerifiedFact = {
  id: string
  fact_type: string
  fact_value: string
  source_quote: string | null
  confidence_score: number | null
  source_documents: { url: string } | null
}

// Verified facts + the URL of the source doc each one cites. RLS (0029)
// scopes this to offers the current user can see; before 0029 is applied it
// simply returns [] for non-admins.
export async function getVerifiedFacts(
  offerId: string
): Promise<VerifiedFact[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('extracted_facts')
    .select(
      'id, fact_type, fact_value, source_quote, confidence_score, source_documents(url)'
    )
    .eq('offer_id', offerId)
    .eq('status', 'verified')
  return (data ?? []) as VerifiedFact[]
}

export type LatestDeepBrief = {
  id: string
  payload: unknown
  created_at: string
} | null

export async function getLatestDeepBrief(offerId: string): Promise<LatestDeepBrief> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('offer_deep_briefs')
    .select('id, payload, created_at')
    .eq('offer_id', offerId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  return (data as LatestDeepBrief) ?? null
}

export type LatestAvatar = {
  id: string
  payload: unknown
  created_at: string
} | null

export async function getLatestAvatar(offerId: string): Promise<LatestAvatar> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('offer_avatars')
    .select('id, payload, created_at')
    .eq('offer_id', offerId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  return (data as LatestAvatar) ?? null
}

export type LatestSpyAnalysis = {
  id: string
  payload: unknown
  input_type: string
  raw_input: string
  created_at: string
} | null

export async function getLatestSpyAnalysis(offerId: string): Promise<LatestSpyAnalysis> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('spy_analyses')
    .select('id, payload, input_type, raw_input, created_at')
    .eq('offer_id', offerId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  return (data as LatestSpyAnalysis) ?? null
}

// Does this offer have a usable verdict (a successful underwriting run)?
export async function hasSuccessfulUnderwriting(
  offerId: string
): Promise<boolean> {
  const supabase = await createClient()
  const { count } = await supabase
    .from('ai_runs')
    .select('*', { count: 'exact', head: true })
    .eq('offer_id', offerId)
    .eq('orchestrator_name', 'UnderwritingOrchestrator')
    .eq('status', 'success')
  return (count ?? 0) > 0
}
