// Domain row types, derived from the generated Database schema. The jsonb
// columns (evaluation / output_payload) are narrowed from Json to the agent
// contract so the UI gets a typed scorecard/verdict.
import type { UnderwritingResponse } from '@/types/agents/underwriting'
import type { Database } from '@/types/database'

type Tables = Database['public']['Tables']
type Enums = Database['public']['Enums']

export type Vertical = Tables['verticals']['Row']
export type OfferStatus = Enums['offer_status']
export type AiRunStatus = Enums['ai_run_status']

export type Offer = Omit<Tables['offers']['Row'], 'evaluation'> & {
  evaluation: UnderwritingResponse | null
}

export type AiRun = Omit<Tables['ai_runs']['Row'], 'output_payload'> & {
  output_payload: UnderwritingResponse | null
}
