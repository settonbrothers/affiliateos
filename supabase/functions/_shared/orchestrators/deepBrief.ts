import { callAnthropicWithTool } from '../anthropicJson.ts'
import { assertNotPaused } from '../killSwitch.ts'
import { loadActivePrompt } from '../loadActivePrompt.ts'
import { runWebSearch } from '../adapters/webSearch.ts'
import { DeepBriefResponseSchema } from '../types/deepBrief.ts'

export { OrchestratorPausedError } from '../killSwitch.ts'

const MODEL = 'claude-sonnet-4-6'
const TOOL_NAME = 'submit_deep_brief'
const TOOL_DESCRIPTION =
  'Submit the complete deep brief for this affiliate offer. Populate every field. Call this tool exactly once.'

export type DeepBriefInput = {
  offer: {
    id: string
    name: string
    website_url?: string | null
    operator_notes?: string | null
  }
}

export type OrchestratorResult = {
  output: Record<string, unknown>
  usage?: { input_tokens: number; output_tokens: number; cost_usd: number }
  mode: 'real' | 'mock'
}

function mockDeepBrief(): Record<string, unknown> {
  return {
    what_we_sell: 'Mock: A high-converting affiliate offer with proven results.',
    main_differentiator: 'Mock: Category-leading product with unique positioning.',
    timing: 'Mock: Demand is rising — ideal time to enter the market.',
    must_know: [
      'Mock: Commission rate and cookie duration.',
      'Mock: Refund policy and support quality.',
      'Mock: Traffic restrictions and compliance requirements.',
    ],
    emotional_connection: 'Mock: Audience wants to feel in control and ahead of the curve.',
    normal_state_meaning: 'Mock: Life after purchase is easier, faster, and less stressful.',
    control_in_hands: 'Mock: The buyer makes an informed, confident decision with clear next steps.',
    proofs: [
      'Mock: Verified testimonials from real users.',
      'Mock: Published case studies with measurable outcomes.',
    ],
    real_confidence: 'Mock: Strong brand trust backed by a generous refund policy.',
    crack_post_params: {
      problem_pain: 'Mock: The audience struggles with X and loses time/money daily.',
      solution: 'Mock: This product solves X directly with minimal effort.',
      urgency: 'Mock: Limited-time pricing or seasonal demand spike.',
      agenda_proof: 'Mock: Hundreds of verified buyers + recognizable brand.',
      benefit_amplified: 'Mock: Imagine saving 10 hours a week and doubling your output.',
      belief_it_will_happen: 'Mock: Step-by-step onboarding ensures results within 7 days.',
      cta_placeholder: 'Get started today →',
    },
    search_summary: 'Mock: Web search not available in mock mode.',
  }
}

export async function runDeepBrief(
  input: DeepBriefInput
): Promise<OrchestratorResult> {
  await assertNotPaused('DeepBriefOrchestrator')

  if (!Deno.env.get('ANTHROPIC_API_KEY')) {
    return { output: mockDeepBrief(), mode: 'mock' }
  }

  const systemPrompt = await loadActivePrompt('DeepBriefOrchestrator')

  // Web search: enrich the prompt with live data when a search key is available.
  let searchSummary: string | null = null
  if (Deno.env.get('DISCOVERY_SEARCH_API_KEY') && input.offer.website_url) {
    try {
      const candidates = await runWebSearch(
        `${input.offer.name} affiliate program review commission terms`,
        5
      )
      if (candidates.length > 0) {
        searchSummary = candidates
          .map((c) => `[${c.name}](${c.url}): ${c.snippet}`)
          .join('\n')
      }
    } catch {
      // Search failure is non-fatal — proceed without it.
    }
  }

  const userMessage = JSON.stringify(
    {
      offer: {
        id: input.offer.id,
        name: input.offer.name,
        website_url: input.offer.website_url ?? null,
        operator_notes: input.offer.operator_notes ?? null,
      },
      search_results: searchSummary ?? null,
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
    responseSchema: DeepBriefResponseSchema,
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
