import { callAnthropicWithTool } from '../anthropicJson.ts'
import { assertNotPaused } from '../killSwitch.ts'
import { loadActivePrompt } from '../loadActivePrompt.ts'
import { SpyAnalysisResponseSchema } from '../types/spyAnalysis.ts'

export { OrchestratorPausedError } from '../killSwitch.ts'

const MODEL = 'claude-sonnet-4-6'
const TOOL_NAME = 'submit_spy_analysis'
const TOOL_DESCRIPTION =
  'Submit the complete spy analysis for the provided ad copy or landing page. Populate every field. Call this tool exactly once.'

export type SpyAnalysisInput = {
  offer: { id: string; name: string; vertical?: string | null }
  rawInput: string  // the pasted text or fetched URL content
  inputType: 'text' | 'url' | 'batch'
}

export type OrchestratorResult = {
  output: Record<string, unknown>
  usage?: { input_tokens: number; output_tokens: number; cost_usd: number }
  mode: 'real' | 'mock'
}

function mockSpyAnalysis(): Record<string, unknown> {
  return {
    input_summary: 'Mock: Analyzed 1 ad creative with landing page copy.',
    hook_analysis: {
      hooks_found: [
        'Mock: "Are you tired of struggling with X?" — pain hook',
        'Mock: "Discover the secret that top affiliates use" — curiosity hook',
      ],
      hook_type: 'pain',
      hook_strength: 'strong',
    },
    meat_analysis: 'Mock: The body focuses heavily on transformation — before/after framing. Emphasizes speed and simplicity. Uses bullet points to highlight 3 key benefits with social proof woven in.',
    cta_analysis: 'Mock: CTA is "Get Started Now" — urgency-driven with a scarcity element ("Limited spots available"). Single clear action above the fold.',
    psychological_triggers: [
      'Mock: Scarcity — limited time offer',
      'Mock: Social proof — "10,000+ users"',
      'Mock: Authority — expert endorsement',
      'Mock: Fear of missing out (FOMO)',
    ],
    template_structure: 'PAS (Problem → Agitate → Solve)',
    winning_elements: [
      'Mock: Clear, benefit-driven headline',
      'Mock: Strong visual hierarchy with one focal CTA',
      'Mock: Specific number in social proof builds credibility',
    ],
    style: 'emotional',
    what_not_to_copy: [
      'Mock: Overpromising language — compliance risk',
      'Mock: Cluttered layout with multiple competing CTAs',
    ],
    gaps_opportunities: [
      'Mock: No testimonials from specific demographics — opportunity to target our niche',
      'Mock: Missing urgency beyond scarcity — deadline countdown could boost CVR',
      'Mock: No risk-reversal / guarantee mentioned',
    ],
  }
}

export async function runSpyAnalysis(
  input: SpyAnalysisInput
): Promise<OrchestratorResult> {
  await assertNotPaused('SpyAnalysisOrchestrator')

  if (!Deno.env.get('ANTHROPIC_API_KEY')) {
    return { output: mockSpyAnalysis(), mode: 'mock' }
  }

  const systemPrompt = await loadActivePrompt('SpyAnalysisOrchestrator')

  // If inputType is 'url', attempt to fetch the page content and use it instead.
  let contentToAnalyze = input.rawInput
  if (input.inputType === 'url') {
    try {
      const res = await fetch(input.rawInput)
      const html = await res.text()
      // Truncate to 4000 chars to keep context manageable
      contentToAnalyze = html.slice(0, 4000)
    } catch {
      // Non-fatal — use raw input (the URL itself) as-is
      contentToAnalyze = input.rawInput
    }
  }

  const userMessage = JSON.stringify(
    {
      offer: {
        id: input.offer.id,
        name: input.offer.name,
        vertical: input.offer.vertical ?? null,
      },
      input_type: input.inputType,
      content: contentToAnalyze,
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
    responseSchema: SpyAnalysisResponseSchema,
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
