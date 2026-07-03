import { createClient } from '@/lib/supabase/server'

export type CampaignRow = {
  id: string
  name: string
  status: string
  channel: string | null
  geo: string | null
  offer_id: string
  test_kit_id: string | null
  created_at: string
  offers: { name: string } | null
}

export async function listCampaigns(): Promise<CampaignRow[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('campaigns')
    .select(
      'id, name, status, channel, geo, offer_id, test_kit_id, created_at, offers(name)'
    )
    .order('created_at', { ascending: false })
    .returns<CampaignRow[]>()
  return data ?? []
}

export async function getCampaign(id: string): Promise<CampaignRow | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('campaigns')
    .select(
      'id, name, status, channel, geo, offer_id, test_kit_id, created_at, offers(name)'
    )
    .eq('id', id)
    .maybeSingle()
    .returns<CampaignRow>()
  return data ?? null
}

export type CampaignResultsRow = {
  spend_usd: number | string
  impressions: number
  clicks: number
  landing_views: number
  conversions: number
  revenue_usd: number | string
  days_running: number
} | null

export async function getCampaignResults(
  campaignId: string
): Promise<CampaignResultsRow> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('campaign_results')
    .select(
      'spend_usd, impressions, clicks, landing_views, conversions, revenue_usd, days_running'
    )
    .eq('campaign_id', campaignId)
    .maybeSingle()
  return (data as CampaignResultsRow) ?? null
}

export async function getLatestDiagnosis(
  campaignId: string
): Promise<{
  id: string
  payload: unknown
  created_at: string
  creative_analysis: unknown
  winning_hooks: unknown
  winners_added_to_library: boolean | null
} | null> {
  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any)
    .from('result_diagnoses')
    .select('id, payload, created_at, creative_analysis, winning_hooks, winners_added_to_library')
    .eq('campaign_id', campaignId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  return data ?? null
}
