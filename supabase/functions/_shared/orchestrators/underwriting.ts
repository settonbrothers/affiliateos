import { runWebSearch } from '../adapters/webSearch.ts'
import { callAnthropicWithTool } from '../anthropicJson.ts'
import { fetchPageText } from '../fetchPage.ts'
import { assertNotPaused } from '../killSwitch.ts'
import { loadActivePrompt } from '../loadActivePrompt.ts'
import { mockUnderwriting, type UnderwritingFactInput } from '../mockAi.ts'
import { UnderwritingResponseSchema } from '../types/underwriting.ts'

// Re-export so existing callers that imported OrchestratorPausedError from this
// module keep working; the canonical definition lives in ../killSwitch.ts.
export { OrchestratorPausedError } from '../killSwitch.ts'

const MODEL = 'claude-sonnet-4-6'
const TOOL_NAME = 'submit_underwriting_decision'
const TOOL_DESCRIPTION =
  'Submit the complete underwriting evaluation for this affiliate offer. Populate every field. Call this tool exactly once.'

export type OperatorContext = {
  experience_level?: string | null
  cashflow_tolerance?: string | null
  primary_channels?: string[]
  typical_budget_range_usd?: [number, number] | null
}

type UnderwritingInput = {
  offerId: string
  offerName?: string
  websiteUrl?: string | null
  affiliateProgramUrl?: string | null
  shortDescription?: string | null
  network?: string | null
  vendorName?: string | null
  verticalSlug?: string
  facts?: UnderwritingFactInput[]
  operatorNotes?: string | null
  // The operator's profile (from onboarding) — feeds operator_fit scoring.
  userContext?: OperatorContext | null
}

const MAX_PAGE_TEXT_FOR_LLM = 60_000
const RESEARCH_RESULTS_PER_QUERY = 3

// Gap-fill queries aimed at the dimensions extracted facts rarely cover. The
// pattern is DiscoveryDeepOrchestrator's, which is the only place in the system
// that was already researching before scoring; underwriting scored 13
// dimensions with no page and no search at all.
function researchQueries(name: string): string[] {
  return [
    `${name} affiliate program commission payout terms`,
    `${name} affiliate paid traffic policy brand bidding`,
    `${name} affiliate program review does it pay`,
    `${name} reviews refund policy complaints`,
  ]
}

type ResearchResult = {
  query: string
  results: Array<{ title: string; url: string; snippet: string }>
}

async function gatherResearch(name: string): Promise<ResearchResult[]> {
  if (!Deno.env.get('DISCOVERY_SEARCH_API_KEY')) return []
  const out: ResearchResult[] = []
  for (const query of researchQueries(name)) {
    try {
      const found = await runWebSearch(query, RESEARCH_RESULTS_PER_QUERY)
      out.push({
        query,
        results: found.map((f) => ({
          title: f.name,
          url: f.url,
          snippet: f.snippet,
        })),
      })
    } catch {
      // A failed query is missing evidence, not a failed analysis. The model is
      // told to leave what it cannot establish in `unknowns` / `missing_data`.
    }
  }
  return out
}

export type OrchestratorResult = {
  output: Record<string, unknown>
  usage?: { input_tokens: number; output_tokens: number; cost_usd: number }
  mode: 'real' | 'mock'
}

// Real Sonnet 4.6 call when ANTHROPIC_API_KEY is set; otherwise mock so the
// app stays usable in pre-key environments and during local dev. Both paths
// return the same envelope+payload shape so analyze-offer is agnostic.
export async function runUnderwriting(
  input: UnderwritingInput
): Promise<OrchestratorResult> {
  await assertNotPaused('UnderwritingOrchestrator')

  const facts = input.facts ?? []

  if (!Deno.env.get('ANTHROPIC_API_KEY')) {
    return { output: mockUnderwriting(facts), mode: 'mock' }
  }

  const systemPrompt = await loadActivePrompt(
    'UnderwritingOrchestrator',
    input.verticalSlug
  )

  const operatorNotes =
    input.operatorNotes && input.operatorNotes.trim().length > 0
      ? input.operatorNotes.trim()
      : null

  // Read the offer for itself instead of scoring it blind. Both are optional:
  // no key means no research, an unreachable page means no page text, and the
  // model is told to leave what it cannot establish unresolved.
  const [pageText, research] = await Promise.all([
    fetchPageText(input.websiteUrl, 'AffiliateOS-Underwriting/1.0'),
    input.offerName ? gatherResearch(input.offerName) : Promise.resolve([]),
  ])

  const userMessage = JSON.stringify(
    {
      offer_id: input.offerId,
      offer_name: input.offerName ?? null,
      website_url: input.websiteUrl ?? null,
      affiliate_program_url: input.affiliateProgramUrl ?? null,
      short_description: input.shortDescription ?? null,
      network: input.network ?? null,
      vendor_name: input.vendorName ?? null,
      vertical: input.verticalSlug ?? null,
      facts: facts.map((f) => ({
        type: f.fact_type,
        value: f.fact_value,
        source_quote: f.source_quote,
        confidence: f.confidence_score,
      })),
      page_text: pageText ? pageText.slice(0, MAX_PAGE_TEXT_FOR_LLM) : null,
      research,
      operator_notes: operatorNotes,
      user_context: input.userContext ?? null,
    },
    null,
    2
  )

  const result = await callAnthropicWithTool({
    model: MODEL,
    systemPrompt,
    userMessage,
    toolName: TOOL_NAME,
    toolDescription: TOOL_DESCRIPTION,
    responseSchema: UnderwritingResponseSchema,
  })

  return {
    output: result.data as unknown as Record<string, unknown>,
    usage: {
      input_tokens: result.usage.input_tokens,
      output_tokens: result.usage.output_tokens,
      cost_usd: result.cost_usd,
    },
    mode: 'real',
  }
}
