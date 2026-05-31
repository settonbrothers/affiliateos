import { callAnthropicWithTool } from '../anthropicJson.ts'
import { assertNotPaused } from '../killSwitch.ts'
import { loadActivePrompt } from '../loadActivePrompt.ts'
import { mockSourceExtraction } from '../mockAi.ts'
import { SourceExtractionResponseSchema } from '../types/sourceExtraction.ts'

const MODEL = 'claude-haiku-4-5-20251001'
const TOOL_NAME = 'submit_extraction'
const TOOL_DESCRIPTION =
  'Submit the structured extraction of facts + summary from the page. Call this tool exactly once.'

// Hard cap on raw_text we send to the model — keeps prompt size + cost sane.
// The ingest-source edge fn already truncates HTML; this is a second guard.
const MAX_RAW_TEXT_FOR_LLM = 100_000

type SourceExtractionInput = {
  offerId: string
  url: string
  rawText: string
}

export type OrchestratorResult = {
  output: Record<string, unknown>
  usage?: { input_tokens: number; output_tokens: number; cost_usd: number }
  mode: 'real' | 'mock'
}

// Real Haiku 4.5 call when ANTHROPIC_API_KEY is set; otherwise the mock
// fixture so M2 keeps working for cost-free dev.
export async function runSourceExtraction(
  input: SourceExtractionInput
): Promise<OrchestratorResult> {
  await assertNotPaused('SourceExtractionOrchestrator')

  if (!Deno.env.get('ANTHROPIC_API_KEY')) {
    return { output: mockSourceExtraction(), mode: 'mock' }
  }

  const systemPrompt = await loadActivePrompt('SourceExtractionOrchestrator')

  const userMessage = JSON.stringify(
    {
      url: input.url,
      raw_text: input.rawText.slice(0, MAX_RAW_TEXT_FOR_LLM),
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
    responseSchema: SourceExtractionResponseSchema,
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
