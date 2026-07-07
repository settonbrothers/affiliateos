import { createClient } from '@/lib/supabase/server'
import type { UnderwritingResponse } from '@/types/agents/underwriting'
import type { AiRun, Offer, Vertical } from '@/types/db'

export async function listVerticals(): Promise<Vertical[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('verticals')
    .select('*')
    .order('display_order')
  if (error) console.error('[queries/offers] DB error:', error)
  return (data ?? []) as Vertical[]
}

export async function listOffers(): Promise<Offer[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('offers')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) console.error('[queries/offers] DB error:', error)
  const offers = (data ?? []) as Offer[]
  if (offers.length === 0) return offers

  // Score/verdict live on the latest UnderwritingOrchestrator run, not on
  // offers.evaluation — enrich each offer so the list can show its Crack Score.
  const { data: runs, error: runsError } = await supabase
    .from('ai_runs')
    .select('offer_id, output_payload, created_at')
    .eq('orchestrator_name', 'UnderwritingOrchestrator')
    .not('output_payload', 'is', null)
    .in(
      'offer_id',
      offers.map((o) => o.id)
    )
    .order('created_at', { ascending: false })
  if (runsError) console.error('[queries/offers] DB error:', runsError)

  const latestByOffer = new Map<string, UnderwritingResponse>()
  for (const r of runs ?? []) {
    if (r.offer_id && !latestByOffer.has(r.offer_id)) {
      latestByOffer.set(r.offer_id, r.output_payload as unknown as UnderwritingResponse)
    }
  }

  return offers.map((o) =>
    o.evaluation ? o : { ...o, evaluation: latestByOffer.get(o.id) ?? null }
  )
}

export async function getOfferById(id: string): Promise<Offer | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('offers')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (error) console.error('[queries/offers] DB error:', error)
  return (data as Offer | null) ?? null
}

export async function getLatestRun(offerId: string): Promise<AiRun | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('ai_runs')
    .select('*')
    .eq('offer_id', offerId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) console.error('[queries/offers] DB error:', error)
  return (data as AiRun | null) ?? null
}

export async function getLatestRunByOrchestrator(
  offerId: string,
  orchestratorName: string
): Promise<AiRun | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('ai_runs')
    .select('*')
    .eq('offer_id', offerId)
    .eq('orchestrator_name', orchestratorName)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) console.error('[queries/offers] DB error:', error)
  return (data as AiRun | null) ?? null
}

export type LatestTestKit = {
  id: string
  payload: unknown
  created_at: string
} | null

export async function getLatestTestKit(offerId: string): Promise<LatestTestKit> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('test_kits')
    .select('id, payload, created_at')
    .eq('offer_id', offerId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) console.error('[queries/offers] DB error:', error)
  return (data as LatestTestKit) ?? null
}

export type LatestAdCopy = {
  id: string
  payload: unknown
  selected_hook_indices: number[] | null
  created_at: string
} | null

export async function getLatestAdCopy(offerId: string): Promise<LatestAdCopy> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('ad_copy_generations')
    .select('id, payload, selected_hook_indices, created_at')
    .eq('offer_id', offerId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) console.error('[queries/offers] DB error:', error)
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
  const { data, error } = await supabase
    .from('offer_compliance_warnings')
    .select(
      'id, overall_risk_level, compliance_score, suggested_verdict_cap, payload, created_at'
    )
    .eq('offer_id', offerId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) console.error('[queries/offers] DB error:', error)
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
  const { data, error } = await supabase
    .from('extracted_facts')
    .select(
      'id, fact_type, fact_value, source_quote, confidence_score, source_documents(url)'
    )
    .eq('offer_id', offerId)
    .eq('status', 'verified')
  if (error) console.error('[queries/offers] DB error:', error)
  return (data ?? []) as VerifiedFact[]
}

export type LatestDeepBrief = {
  id: string
  payload: unknown
  created_at: string
} | null

export async function getLatestDeepBrief(offerId: string): Promise<LatestDeepBrief> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('offer_deep_briefs')
    .select('id, payload, created_at')
    .eq('offer_id', offerId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) console.error('[queries/offers] DB error:', error)
  return (data as LatestDeepBrief) ?? null
}

export type LatestAvatar = {
  id: string
  payload: unknown
  created_at: string
} | null

export async function getLatestAvatar(offerId: string): Promise<LatestAvatar> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('offer_avatars')
    .select('id, payload, created_at')
    .eq('offer_id', offerId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) console.error('[queries/offers] DB error:', error)
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
  const { data, error } = await supabase
    .from('spy_analyses')
    .select('id, payload, input_type, raw_input, created_at')
    .eq('offer_id', offerId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) console.error('[queries/offers] DB error:', error)
  return (data as LatestSpyAnalysis) ?? null
}

export type LatestCreatives = {
  id: string
  payload: unknown
  created_at: string
} | null

export async function getLatestCreatives(offerId: string): Promise<LatestCreatives> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('offer_creatives')
    .select('id, payload, created_at')
    .eq('offer_id', offerId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) console.error('[queries/offers] DB error:', error)
  return (data as LatestCreatives) ?? null
}

export type OfferNetworkData = {
  id: string
  offer_id: string
  network_name: string
  epc_usd: number | null
  commission_rate: number | null
  commission_type: string | null
  payout_usd: number | null
  network_url: string | null
  is_recommended: boolean
  notes: string | null
  created_at: string
  updated_at: string
}

export async function getOfferNetworkData(offerId: string): Promise<OfferNetworkData[]> {
  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('offer_network_data')
    .select('*')
    .eq('offer_id', offerId)
    .order('is_recommended', { ascending: false })
  if (error) console.error('[queries/offers] DB error:', error)
  return (data ?? []) as OfferNetworkData[]
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
