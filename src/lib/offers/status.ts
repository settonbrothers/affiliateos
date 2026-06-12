import type { OfferStatus } from '@/types/db'

// Exhaustive (Record<OfferStatus, …>) so adding an enum value without a label
// becomes a compile error rather than a blank badge.
export const OFFER_STATUS_LABELS: Record<OfferStatus, string> = {
  draft: 'Draft',
  needs_source_ingestion: 'Needs sources',
  ready_for_analysis: 'Ready for analysis',
  ai_analyzed: 'Analyzed',
  published: 'Published',
  rejected: 'Rejected',
  deprecated: 'Deprecated',
}

export const OFFER_STATUS_BADGE_CLASS: Record<OfferStatus, string> = {
  draft: 'border-zinc-300 bg-zinc-100 text-zinc-700',
  needs_source_ingestion: 'border-amber-300 bg-amber-100 text-amber-800',
  ready_for_analysis: 'border-blue-300 bg-blue-100 text-blue-800',
  ai_analyzed: 'border-green-300 bg-green-100 text-green-800',
  published: 'border-emerald-400 bg-emerald-100 text-emerald-900',
  rejected: 'border-red-300 bg-red-100 text-red-800',
  deprecated: 'border-zinc-300 bg-zinc-100 text-zinc-500',
}
