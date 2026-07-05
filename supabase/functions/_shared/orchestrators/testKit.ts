import { callAnthropicWithTool } from '../anthropicJson.ts'
import { assertNotPaused } from '../killSwitch.ts'
import { loadActivePrompt } from '../loadActivePrompt.ts'
import { mockTestKit } from '../mockAi.ts'
import { TestKitResponseSchema } from '../types/testKit.ts'

export { OrchestratorPausedError } from '../killSwitch.ts'

const MODEL = 'claude-sonnet-4-6'
const TOOL_NAME = 'submit_test_kit'
const TOOL_DESCRIPTION =
  'Submit the complete test kit for this affiliate offer. Populate every field. Call this tool exactly once.'

type TestKitInput = {
  offerId: string
  offerName?: string
  verticalSlug?: string
  operatorNotes?: string | null
  // Optional upstream context from the data chain.
  deepBriefContext?: Record<string, unknown> | null
  avatarContext?: Record<string, unknown> | null
  spyContext?: Record<string, unknown> | null
}

export type OrchestratorResult = {
  output: Record<string, unknown>
  usage?: { input_tokens: number; output_tokens: number; cost_usd: number }
  mode: 'real' | 'mock'
}

// Real Sonnet 4.6 call when ANTHROPIC_API_KEY is set; otherwise the mock
// fixture so the flow stays usable pre-key. Both return the same envelope+
// payload shape so generate-test-kit is agnostic.
export async function runTestKit(
  input: TestKitInput
): Promise<OrchestratorResult> {
  await assertNotPaused('TestKitOrchestrator')

  if (!Deno.env.get('ANTHROPIC_API_KEY')) {
    return { output: mockTestKit(), mode: 'mock' }
  }

  const systemPrompt = await loadActivePrompt(
    'TestKitOrchestrator',
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
      operator_notes: operatorNotes,
      deep_brief: input.deepBriefContext ?? null,
      avatar: input.avatarContext ?? null,
      spy: input.spyContext ?? null,
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
    responseSchema: TestKitResponseSchema,
    maxTokens: 8192,
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
