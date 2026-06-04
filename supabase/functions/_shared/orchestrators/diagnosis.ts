import { callAnthropicWithTool } from '../anthropicJson.ts'
import { assertNotPaused } from '../killSwitch.ts'
import { loadActivePrompt } from '../loadActivePrompt.ts'
import { mockDiagnosis, type DiagnosisResultsInput } from '../mockAi.ts'
import { DiagnosisResponseSchema } from '../types/diagnosis.ts'

export { OrchestratorPausedError } from '../killSwitch.ts'

const MODEL = 'claude-sonnet-4-6'
const TOOL_NAME = 'submit_diagnosis'
const TOOL_DESCRIPTION =
  'Submit the complete diagnosis of this campaign result. Populate every field. Call this tool exactly once.'

type DiagnosisInput = {
  campaign: {
    id: string
    name?: string
    channel?: string | null
    geo?: string | null
  }
  verticalSlug?: string
  testKit?: Record<string, unknown> | null
  results: DiagnosisResultsInput
  dataQualityScore: number
}

export type OrchestratorResult = {
  output: Record<string, unknown>
  usage?: { input_tokens: number; output_tokens: number; cost_usd: number }
  mode: 'real' | 'mock'
}

export async function runDiagnosis(
  input: DiagnosisInput
): Promise<OrchestratorResult> {
  await assertNotPaused('DiagnosisOrchestrator')

  if (!Deno.env.get('ANTHROPIC_API_KEY')) {
    return { output: mockDiagnosis(input.results), mode: 'mock' }
  }

  const systemPrompt = await loadActivePrompt(
    'DiagnosisOrchestrator',
    input.verticalSlug
  )

  const testKitPayload =
    (input.testKit as { payload?: unknown } | null | undefined)?.payload ??
    input.testKit ??
    null

  const userMessage = JSON.stringify(
    {
      campaign: {
        id: input.campaign.id,
        name: input.campaign.name ?? null,
        channel: input.campaign.channel ?? null,
        geo: input.campaign.geo ?? null,
      },
      vertical: input.verticalSlug ?? null,
      test_kit: testKitPayload,
      results: input.results,
      data_quality_score: input.dataQualityScore,
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
    responseSchema: DiagnosisResponseSchema,
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
