// Domain row types, derived from the generated Database schema. The jsonb
// columns (evaluation / output_payload) are narrowed from Json to the agent
// contract so the UI gets a typed scorecard/verdict.
// The STORED variant: rows written before per-dimension reasoning keep a bare
// number for each score, so the read path has to accept both shapes.
import type { StoredUnderwritingResponse } from '@/types/agents/underwriting'
import type { Database } from '@/types/database'

type Tables = Database['public']['Tables']
type Enums = Database['public']['Enums']

export type Vertical = Tables['verticals']['Row']
export type OfferStatus = Enums['offer_status']
export type AiRunStatus = Enums['ai_run_status']
export type FactType = Enums['fact_type']
export type FactStatus = Enums['fact_status']

export type Offer = Omit<Tables['offers']['Row'], 'evaluation'> & {
  evaluation: StoredUnderwritingResponse | null
}

export type AiRun = Omit<Tables['ai_runs']['Row'], 'output_payload'> & {
  output_payload: StoredUnderwritingResponse | null
}
