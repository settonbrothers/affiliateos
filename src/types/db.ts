// Minimal hand-authored row types used until `supabase gen types` produces
// src/types/database.ts (after the project is linked — 06 protocol rule 4).
// TODO(types): replace these with the generated Database types.
import type { UnderwritingResponse } from '@/types/agents/underwriting'

export type Vertical = {
  id: string
  slug: string
  name: string
  enabled_for_users: boolean
  display_order: number
}

export type OfferStatus =
  | 'draft'
  | 'needs_source_ingestion'
  | 'ready_for_analysis'
  | 'ai_analyzed'
  | 'published'
  | 'rejected'
  | 'deprecated'

export type Offer = {
  id: string
  name: string
  slug: string
  status: OfferStatus
  vertical_id: string
  website_url: string | null
  affiliate_program_url: string | null
  short_description: string | null
  evaluation: UnderwritingResponse | null
  created_at: string
}

export type AiRunStatus = 'pending' | 'running' | 'success' | 'partial' | 'failed'

export type AiRun = {
  id: string
  status: AiRunStatus
  orchestrator_name: string
  output_payload: UnderwritingResponse | null
  error_message: string | null
  created_at: string
}
