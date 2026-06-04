import { callAnthropicWithTool } from '../anthropicJson.ts'
import { assertNotPaused } from '../killSwitch.ts'
import { loadActivePrompt } from '../loadActivePrompt.ts'
import { mockCompliance, type UnderwritingFactInput } from '../mockAi.ts'
import { ComplianceResponseSchema } from '../types/compliance.ts'

export { OrchestratorPausedError } from '../killSwitch.ts'

const MODEL = 'claude-haiku-4-5-20251001'
const TOOL_NAME = 'submit_compliance_check'
const TOOL_DESCRIPTION =
  'Submit the compliance review for this offer. Populate every field. Call this tool exactly once.'

type ComplianceInput = {
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

export async function runComplianceCheck(
  input: ComplianceInput
): Promise<OrchestratorResult> {
  await assertNotPaused('ComplianceCheckOrchestrator')

  const facts = input.facts ?? []

  if (!Deno.env.get('ANTHROPIC_API_KEY')) {
    return { output: mockCompliance(input.verticalSlug), mode: 'mock' }
  }

  const systemPrompt = await loadActivePrompt(
    'ComplianceCheckOrchestrator',
    input.verticalSlug
  )

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
      operator_notes:
        input.operatorNotes && input.operatorNotes.trim().length > 0
          ? input.operatorNotes.trim()
          : null,
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
    responseSchema: ComplianceResponseSchema,
    maxTokens: 4096,
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
