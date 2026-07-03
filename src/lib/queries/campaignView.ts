import { createClient } from '@/lib/supabase/server'

export type CampaignViewData = {
  deepBrief: Record<string, unknown> | null
  avatar: Record<string, unknown> | null
  spyInsights: Record<string, unknown> | null
  adCopy: Record<string, unknown> | null // latest ad_copy_generations payload
  creatives: Record<string, unknown> | null
}

export async function getCampaignViewData(offerId: string): Promise<CampaignViewData> {
  const supabase = await createClient()

  const [deepBriefRes, avatarRes, spyRes, adCopyRes, creativesRes] = await Promise.all([
    supabase
      .from('offer_deep_briefs')
      .select('payload')
      .eq('offer_id', offerId)
      .eq('status', 'generated')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('offer_avatars')
      .select('payload')
      .eq('offer_id', offerId)
      .eq('status', 'generated')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('spy_analyses')
      .select('payload')
      .eq('offer_id', offerId)
      .eq('status', 'generated')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('ad_copy_generations')
      .select('payload')
      .eq('offer_id', offerId)
      .eq('status', 'generated')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('offer_creatives')
      .select('payload')
      .eq('offer_id', offerId)
      .eq('status', 'generated')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  if (deepBriefRes.error) console.error('campaignView query error:', deepBriefRes.error)
  if (avatarRes.error) console.error('campaignView query error:', avatarRes.error)
  if (spyRes.error) console.error('campaignView query error:', spyRes.error)
  if (adCopyRes.error) console.error('campaignView query error:', adCopyRes.error)
  if (creativesRes.error) console.error('campaignView query error:', creativesRes.error)

  return {
    deepBrief: (deepBriefRes.data?.payload as Record<string, unknown> | undefined) ?? null,
    avatar: (avatarRes.data?.payload as Record<string, unknown> | undefined) ?? null,
    spyInsights: (spyRes.data?.payload as Record<string, unknown> | undefined) ?? null,
    adCopy: (adCopyRes.data?.payload as Record<string, unknown> | undefined) ?? null,
    creatives: (creativesRes.data?.payload as Record<string, unknown> | undefined) ?? null,
  }
}
