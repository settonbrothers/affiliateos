import { callAnthropicWithTool } from '../anthropicJson.ts'
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

type UnderwritingInput = {
  offerId: string
  offerName?: string
  verticalSlug?: string
  facts?: UnderwritingFactInput[]
  operatorNotes?: string | null
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

  const userMessage = JSON.stringify(
    {
      offer_id: input.offerId,
      offer_name: input.offerName ?? null,
      vertical: input.verticalSlug ?? null,
      facts: facts.map((f) => ({
        type: f.fact_type,
        value: f.fact_value,
        source_quote: f.source_quote,
        confidence: f.confidence_score,
      })),
      operator_notes: operatorNotes,
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
