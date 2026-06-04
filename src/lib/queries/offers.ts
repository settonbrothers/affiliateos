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
