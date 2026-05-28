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
