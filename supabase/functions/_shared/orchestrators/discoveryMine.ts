import { callAnthropicWithTool } from '../anthropicJson.ts'
import { assertNotPaused } from '../killSwitch.ts'
import { loadActivePrompt } from '../loadActivePrompt.ts'
import { mockDiscoveryMine } from '../mockAi.ts'
import { MineResponseSchema } from '../types/discovery.ts'

const MODEL = 'claude-haiku-4-5-20251001'
const TOOL_NAME = 'submit_mined_offers'
const TOOL_DESCRIPTION =
  'Submit the individual offers extracted from the container page. Call exactly once.'
const MAX_TEXT_FOR_LLM = 80_000

export type MineInput = { url: string | null; pageText: string }

export type OrchestratorResult = {
  output: Record<string, unknown>
  usage?: { input_tokens: number; output_tokens: number; cost_usd: number }
  mode: 'real' | 'mock'
}

export async function runDiscoveryMine(
  input: MineInput,
  verticalSlug?: string
): Promise<OrchestratorResult> {
  await assertNotPaused('DiscoveryMineOrchestrator')

  if (!Deno.env.get('ANTHROPIC_API_KEY')) {
    return { output: mockDiscoveryMine(), mode: 'mock' }
  }

  const systemPrompt = await loadActivePrompt(
    'DiscoveryMineOrchestrator',
    verticalSlug
  )
  const userMessage = JSON.stringify(
    { url: input.url, page_text: input.pageText.slice(0, MAX_TEXT_FOR_LLM) },
    null,
    2
  )

  const result = await callAnthropicWithTool({
    model: MODEL,
    systemPrompt,
    userMessage,
    toolName: TOOL_NAME,
    toolDescription: TOOL_DESCRIPTION,
    responseSchema: MineResponseSchema,
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
