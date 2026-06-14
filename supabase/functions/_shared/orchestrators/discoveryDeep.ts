import { callAnthropicWithTool } from '../anthropicJson.ts'
import { assertNotPaused } from '../killSwitch.ts'
import { loadActivePrompt } from '../loadActivePrompt.ts'
import { mockDiscoveryDeep } from '../mockAi.ts'
import { DeepAnalysisSchema } from '../types/discovery.ts'

const MODEL = 'claude-sonnet-4-6'
const TOOL_NAME = 'submit_deep_analysis'
const TOOL_DESCRIPTION =
  'Submit the deep quality analysis for this candidate. Call exactly once.'
const MAX_RAW_TEXT_FOR_LLM = 80_000

export type DeepInput = {
  name: string
  url: string | null
  rawText: string
}

export type OrchestratorResult = {
  output: Record<string, unknown>
  usage?: { input_tokens: number; output_tokens: number; cost_usd: number }
  mode: 'real' | 'mock'
}

export async function runDiscoveryDeep(
  input: DeepInput,
  verticalSlug?: string
): Promise<OrchestratorResult> {
  await assertNotPaused('DiscoveryDeepOrchestrator')

  if (!Deno.env.get('ANTHROPIC_API_KEY')) {
    return { output: mockDiscoveryDeep(), mode: 'mock' }
  }

  const systemPrompt = await loadActivePrompt(
    'DiscoveryDeepOrchestrator',
    verticalSlug
  )
  const userMessage = JSON.stringify(
    {
      name: input.name,
      url: input.url,
      page_text: input.rawText.slice(0, MAX_RAW_TEXT_FOR_LLM),
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
    responseSchema: DeepAnalysisSchema,
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
