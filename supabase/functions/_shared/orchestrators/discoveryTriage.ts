import { callAnthropicWithTool } from '../anthropicJson.ts'
import { assertNotPaused } from '../killSwitch.ts'
import { loadActivePrompt } from '../loadActivePrompt.ts'
import { mockDiscoveryTriage } from '../mockAi.ts'
import { TriageResponseSchema } from '../types/discovery.ts'

const MODEL = 'claude-haiku-4-5-20251001'
const TOOL_NAME = 'submit_triage'
const TOOL_DESCRIPTION =
  'Submit a triage result for every input candidate, matched by index. Call exactly once.'

export type TriageCandidateInput = {
  name: string
  url: string | null
  snippet: string
}

export type OrchestratorResult = {
  output: Record<string, unknown>
  usage?: { input_tokens: number; output_tokens: number; cost_usd: number }
  mode: 'real' | 'mock'
}

export async function runDiscoveryTriage(
  candidates: TriageCandidateInput[],
  verticalSlug?: string
): Promise<OrchestratorResult> {
  await assertNotPaused('DiscoveryTriageOrchestrator')

  if (!Deno.env.get('ANTHROPIC_API_KEY')) {
    return { output: mockDiscoveryTriage(candidates.length), mode: 'mock' }
  }

  const systemPrompt = await loadActivePrompt(
    'DiscoveryTriageOrchestrator',
    verticalSlug
  )
  const userMessage = JSON.stringify(
    {
      vertical: verticalSlug ?? null,
      candidates: candidates.map((c, i) => ({
        index: i,
        name: c.name,
        url: c.url,
        snippet: c.snippet,
      })),
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
    responseSchema: TriageResponseSchema,
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
