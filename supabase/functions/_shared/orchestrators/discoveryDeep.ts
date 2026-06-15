import { callAnthropicWithTool } from '../anthropicJson.ts'
import { runWebSearch } from '../adapters/webSearch.ts'
import { assertNotPaused } from '../killSwitch.ts'
import { loadActivePrompt } from '../loadActivePrompt.ts'
import { mockDiscoveryDeep } from '../mockAi.ts'
import { DeepAnalysisSchema } from '../types/discovery.ts'

const MODEL = 'claude-sonnet-4-6'
const TOOL_NAME = 'submit_deep_analysis'
const TOOL_DESCRIPTION =
  'Submit the deep quality analysis for this candidate against the rubric. Call exactly once.'
const MAX_RAW_TEXT_FOR_LLM = 60_000
const RESEARCH_RESULTS_PER_QUERY = 3

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

// Fixed gap-filling queries — these target the hard filters a landing page
// usually can't confirm on its own: real terms/commission, payment reputation
// (shaving / does-it-pay), and paid-traffic policy.
function researchQueries(name: string): string[] {
  return [
    `${name} affiliate program commission payout terms`,
    `${name} affiliate program review does it pay shaving`,
    `${name} affiliate paid traffic brand bidding policy`,
  ]
}

export async function runDiscoveryDeep(
  input: DeepInput,
  verticalSlug?: string
): Promise<OrchestratorResult> {
  await assertNotPaused('DiscoveryDeepOrchestrator')

  if (!Deno.env.get('ANTHROPIC_API_KEY')) {
    return { output: mockDiscoveryDeep(), mode: 'mock' }
  }

  // Step 2: gap-fill research — only when a search key is configured. A failed
  // research query never blocks scoring (the filter just stays unknown_verify).
  const research: Array<{
    query: string
    results: Array<{ title: string; url: string; snippet: string }>
  }> = []
  if (Deno.env.get('DISCOVERY_SEARCH_API_KEY')) {
    for (const q of researchQueries(input.name)) {
      try {
        const found = await runWebSearch(q, RESEARCH_RESULTS_PER_QUERY)
        research.push({
          query: q,
          results: found.map((f) => ({
            title: f.name,
            url: f.url,
            snippet: f.snippet,
          })),
        })
      } catch {
        // skip this query; scoring proceeds with whatever we have
      }
    }
  }

  // Step 3: score against the rubric.
  const systemPrompt = await loadActivePrompt(
    'DiscoveryDeepOrchestrator',
    verticalSlug
  )
  const userMessage = JSON.stringify(
    {
      name: input.name,
      url: input.url,
      page_text: input.rawText.slice(0, MAX_RAW_TEXT_FOR_LLM),
      research,
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
