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
  draft: '',
  needs_source_ingestion: '',
  ready_for_analysis: '',
  ai_analyzed: '',
  published: '',
  rejected: '',
  deprecated: '',
}
