import type { Database } from '@/types/database'

type FactType = Database['public']['Enums']['fact_type']

// Human labels for the fact_type enum (migration 0011). factTypeLabel falls
// back to a humanized raw value so a future enum member can't crash the UI.
const FACT_TYPE_LABELS: Partial<Record<FactType, string>> = {
  commission_value: 'Commission',
  commission_type: 'Commission type',
  payout_delay: 'Payout delay',
  cookie_duration: 'Cookie duration',
  traffic_rule_paid_social: 'Paid social rules',
  traffic_rule_google: 'Google Ads rules',
  traffic_rule_native: 'Native ads rules',
  traffic_rule_youtube: 'YouTube rules',
  traffic_rule_brand_bidding: 'Brand bidding',
  traffic_rule_direct_link: 'Direct linking',
  traffic_rule_email: 'Email rules',
  traffic_rule_seo: 'SEO rules',
  traffic_rule_organic_social: 'Organic social rules',
  allowed_geo: 'Allowed GEOs',
  restricted_geo: 'Restricted GEOs',
  cap: 'Caps',
  refund_policy: 'Refund policy',
  compliance_claim: 'Compliance claim',
  pricing_aov: 'Pricing / AOV',
  minimum_payout: 'Minimum payout',
  contact: 'Contact',
  other: 'Other',
}

export function factTypeLabel(type: string): string {
  return (
    FACT_TYPE_LABELS[type as FactType] ??
    type.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase())
  )
}

// Money/terms facts first; anything unprioritized keeps insertion order after
// them. Within the same priority, highest extraction confidence wins.
const DISPLAY_PRIORITY: readonly FactType[] = [
  'commission_value',
  'commission_type',
  'payout_delay',
  'minimum_payout',
  'cookie_duration',
  'pricing_aov',
  'allowed_geo',
  'restricted_geo',
  'cap',
]

export function sortFactsForDisplay<
  T extends { fact_type: string; confidence_score: number | null },
>(facts: T[]): T[] {
  const rank = (t: string): number => {
    const i = DISPLAY_PRIORITY.indexOf(t as FactType)
    return i === -1 ? DISPLAY_PRIORITY.length : i
  }
  return [...facts].sort(
    (a, b) =>
      rank(a.fact_type) - rank(b.fact_type) ||
      (b.confidence_score ?? 0) - (a.confidence_score ?? 0)
  )
}

// For "source ↗" links — never let a malformed stored URL crash the page.
export function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname
  } catch {
    return url
  }
}
