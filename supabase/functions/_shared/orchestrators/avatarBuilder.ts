import { callAnthropicWithTool } from '../anthropicJson.ts'
import { assertNotPaused } from '../killSwitch.ts'
import { loadActivePrompt } from '../loadActivePrompt.ts'
import { runWebSearch } from '../adapters/webSearch.ts'
import { AvatarBuilderResponseSchema } from '../types/avatarBuilder.ts'

export { OrchestratorPausedError } from '../killSwitch.ts'

const MODEL = 'claude-sonnet-4-6'
const TOOL_NAME = 'submit_avatar_builder'
const TOOL_DESCRIPTION =
  'Submit the complete buyer avatar for this affiliate offer. Populate every field. Call this tool exactly once.'

export type AvatarBuilderInput = {
  offer: {
    id: string
    name: string
    website_url?: string | null
    operator_notes?: string | null
    vertical?: string | null
  }
}

export type OrchestratorResult = {
  output: Record<string, unknown>
  usage?: { input_tokens: number; output_tokens: number; cost_usd: number }
  mode: 'real' | 'mock'
}

function mockAvatarBuilder(): Record<string, unknown> {
  return {
    who: 'Mock: A 38-year-old professional who has tried multiple solutions and is frustrated that nothing has stuck.',
    life_situation: 'Mock: Busy schedule, limited time, feeling stuck in a loop of starting and stopping. Has disposable income but guards it carefully after past disappointments.',
    pain_points: [
      'Mock: "I\'ve wasted money on things that don\'t work before."',
      'Mock: "I don\'t have hours to spend figuring this out every day."',
      'Mock: "I feel like I\'m always one step behind everyone else."',
    ],
    objections: [
      'Mock: "How is this different from what I already tried?"',
      'Mock: "What if it doesn\'t work for me specifically?"',
    ],
    desires: [
      'Mock: To finally feel in control and see real, lasting progress.',
      'Mock: A simple system that works without constant effort.',
      'Mock: To stop second-guessing and start trusting their own decisions.',
    ],
    voice_of_customer: [
      'Mock: "I just want something that actually works."',
      'Mock: "I\'m so tired of starting over."',
      'Mock: "Why can\'t this be simpler?"',
    ],
    transformation: 'Mock: From feeling perpetually behind and skeptical to confident and consistently moving forward with a clear, repeatable system.',
    emotional_trigger: 'Mock: The fear of wasted time and money — and the relief of finally finding something that removes that anxiety for good.',
    trust_signals: [
      'Mock: Real testimonials from people who were equally skeptical before trying.',
      'Mock: A risk-free trial or money-back guarantee that removes the financial fear.',
    ],
  }
}

export async function runAvatarBuilder(
  input: AvatarBuilderInput
): Promise<OrchestratorResult> {
  await assertNotPaused('AvatarBuilderOrchestrator')

  if (!Deno.env.get('ANTHROPIC_API_KEY')) {
    return { output: mockAvatarBuilder(), mode: 'mock' }
  }

  const systemPrompt = await loadActivePrompt('AvatarBuilderOrchestrator')

  // Web search: enrich the prompt with live customer language when available.
  let searchSummary: string | null = null
  if (Deno.env.get('DISCOVERY_SEARCH_API_KEY')) {
    try {
      const candidates = await runWebSearch(
        `${input.offer.name} ${input.offer.vertical ?? ''} target audience customer reviews`,
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
        vertical: input.offer.vertical ?? null,
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
    responseSchema: AvatarBuilderResponseSchema,
    maxTokens: 3000,
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
