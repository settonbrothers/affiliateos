import { callAnthropicWithTool } from '../anthropicJson.ts'
import { runWebSearch } from '../adapters/webSearch.ts'
import { assertNotPaused } from '../killSwitch.ts'
import { loadActivePrompt } from '../loadActivePrompt.ts'
import { NetworkComparisonSchema } from '../types/discoverNetwork.ts'

const MODEL = 'claude-haiku-4-5-20251001'
const TOOL_NAME = 'submit_network_comparison'
const TOOL_DESCRIPTION =
  'Submit network comparison and trending signal data for this affiliate offer. Call exactly once.'
const MAX_TOKENS = 1500
const RESEARCH_RESULTS_PER_QUERY = 5

export type DiscoveryNetworkInput = {
  offer: { id?: string; name: string; url?: string | null; vertical?: string | null }
}

export type OrchestratorResult = {
  output: Record<string, unknown>
  usage?: { input_tokens: number; output_tokens: number; cost_usd: number }
  mode: 'real' | 'mock'
}

function mockNetworkComparison(): Record<string, unknown> {
  return {
    networks_found: [
      {
        network_name: 'Impact',
        estimated_epc_usd: 1.2,
        estimated_commission_type: 'CPA',
        confidence: 'low',
      },
    ],
    recommended_network: 'Impact',
    recommended_reason: 'Mock: most commonly listed for this category.',
    trending_signal: 'stable',
    trending_evidence: 'Mock: no strong trending signals detected.',
  }
}

export async function runDiscoveryNetwork(
  input: DiscoveryNetworkInput
): Promise<OrchestratorResult> {
  await assertNotPaused('DiscoveryNetworkOrchestrator')

  if (!Deno.env.get('ANTHROPIC_API_KEY')) {
    return { output: mockNetworkComparison(), mode: 'mock' }
  }

  // Search for network data
  const searchQuery = `"${input.offer.name}" affiliate program MaxBounty Clickbank CJ ShareASale commission EPC`
  const searchResults: Array<{ title: string; url: string; snippet: string }> = []

  if (Deno.env.get('DISCOVERY_SEARCH_API_KEY')) {
    try {
      const found = await runWebSearch(searchQuery, RESEARCH_RESULTS_PER_QUERY)
      for (const f of found) {
        searchResults.push({ title: f.name, url: f.url, snippet: f.snippet })
      }
    } catch {
      // non-fatal: proceed with empty search results
    }
  }

  const systemPrompt = await loadActivePrompt('DiscoveryNetworkOrchestrator')

  const userMessage = JSON.stringify(
    {
      offer_name: input.offer.name,
      offer_url: input.offer.url ?? null,
      vertical: input.offer.vertical ?? null,
      search_results: searchResults,
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
    responseSchema: NetworkComparisonSchema,
    maxTokens: MAX_TOKENS,
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
