import { z } from 'npm:zod@^3.24.0'
import { callAnthropicWithTool } from '../anthropicJson.ts'
import { assertNotPaused } from '../killSwitch.ts'
import { loadActivePrompt } from '../loadActivePrompt.ts'
import { CREATIVE_TYPES, CreativeEngineResponseSchema } from '../types/creativeEngine.ts'

export { OrchestratorPausedError } from '../killSwitch.ts'

const MODEL = 'claude-sonnet-4-6'
const TOOL_NAME = 'submit_creative_briefs'
const TOOL_DESCRIPTION =
  'Submit 7 creative briefs with detailed DALL-E 3 prompts for this affiliate offer. One brief per creative type. Call this tool exactly once.'

export type CreativeEngineInput = {
  offer: {
    id: string
    name: string
    vertical?: string | null
    description?: string | null
  }
  avatarContext?: string   // brief avatar summary for grounding visuals
  deepBriefContext?: string // brief what_we_sell for grounding
}

export type OrchestratorResult = {
  output: Record<string, unknown>
  usage?: { input_tokens: number; output_tokens: number; cost_usd: number }
  mode: 'real' | 'mock'
}

const CREATIVE_TYPE_LABELS: Record<typeof CREATIVE_TYPES[number], string> = {
  before_after: 'לפני ואחרי',
  problem_visualization: 'ויזואליזציה של הבעיה',
  product_result: 'תצוגת המוצר/תוצאה',
  social_proof: 'הוכחה חברתית',
  testimonial_card: 'כרטיס המלצה',
  data_stats: 'גרפיקה של נתונים/סטטיסטיקות',
  lifestyle_aspiration: 'אורח חיים/שאיפה',
}

function mockCreativeEngine(): Record<string, unknown> {
  return {
    creatives: CREATIVE_TYPES.map((type, i) => ({
      type,
      type_label: CREATIVE_TYPE_LABELS[type],
      dalle_prompt: `Mock DALL-E 3 prompt for ${type}: A photorealistic scene depicting the essence of this affiliate offer, ${type.replace(/_/g, ' ')} style, suitable for Facebook/Instagram advertising, no text or logos, professional photography style, bright and appealing.`,
      image_url: `https://placehold.co/1024x1024?text=Creative+${i + 1}`,
      rationale: `Mock rationale: This ${type.replace(/_/g, ' ')} creative type is effective for this offer because it visually demonstrates the core value proposition.`,
    })),
  }
}

// Intermediate schema — Claude fills this in, then we add image URLs after DALL-E calls.
const CreativeBriefsSchema = z.object({
  briefs: z.array(z.object({
    type: z.enum(CREATIVE_TYPES),
    type_label: z.string(),
    dalle_prompt: z.string(),
    rationale: z.string(),
  })).length(7),
})

export async function runCreativeEngine(
  input: CreativeEngineInput
): Promise<OrchestratorResult> {
  await assertNotPaused('CreativeEngineOrchestrator')

  const hasAnthropicKey = !!Deno.env.get('ANTHROPIC_API_KEY')
  const hasOpenAiKey = !!Deno.env.get('OPENAI_API_KEY')

  if (!hasAnthropicKey) {
    return { output: mockCreativeEngine(), mode: 'mock' }
  }

  // Step 1 — Claude generates 7 DALL-E prompts
  const systemPrompt = await loadActivePrompt('CreativeEngineOrchestrator')

  const userMessage = JSON.stringify(
    {
      offer: {
        id: input.offer.id,
        name: input.offer.name,
        vertical: input.offer.vertical ?? null,
        description: input.offer.description ?? null,
      },
      avatar_context: input.avatarContext ?? null,
      deep_brief_context: input.deepBriefContext ?? null,
      creative_types: CREATIVE_TYPES.map((type) => ({
        type,
        label: CREATIVE_TYPE_LABELS[type],
      })),
    },
    null,
    2
  )

  const briefsResult = await callAnthropicWithTool({
    model: MODEL,
    systemPrompt,
    userMessage,
    toolName: TOOL_NAME,
    toolDescription: TOOL_DESCRIPTION,
    responseSchema: CreativeBriefsSchema,
    maxTokens: 3000,
  })

  const { briefs } = briefsResult.data

  // Step 2 — Call gpt-image-1 for each prompt (sequential to avoid rate limits)
  const openaiKey = Deno.env.get('OPENAI_API_KEY')
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  const creatives: Array<{
    type: string
    type_label: string
    dalle_prompt: string
    image_url: string
    rationale: string
  }> = []

  for (let i = 0; i < briefs.length; i++) {
    const brief = briefs[i]

    if (!hasOpenAiKey || !openaiKey) {
      // Mock image when no OpenAI key
      creatives.push({
        ...brief,
        image_url: `https://placehold.co/1024x1024?text=Creative+${i + 1}`,
      })
      continue
    }

    try {
      const response = await fetch('https://api.openai.com/v1/images/generations', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openaiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-image-1',
          prompt: brief.dalle_prompt,
          n: 1,
          size: '1024x1024',
        }),
      })

      const data = await response.json() as {
        data?: Array<{ b64_json?: string; url?: string }>
        error?: { message: string }
      }

      if (!response.ok || !data.data?.[0]) {
        creatives.push({
          ...brief,
          image_url: `https://placehold.co/1024x1024?text=Creative+${i + 1}`,
        })
      } else {
        const imageData = data.data[0]
        let imageUrl = imageData.url ?? null

        // gpt-image-1 returns b64_json — upload to Supabase Storage for a permanent URL
        if (!imageUrl && imageData.b64_json) {
          const fileName = `${input.offer.id}/${Date.now()}-creative-${i + 1}.png`
          const binary = Uint8Array.from(atob(imageData.b64_json), c => c.charCodeAt(0))

          const uploadRes = await fetch(
            `${supabaseUrl}/storage/v1/object/creatives/${fileName}`,
            {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${supabaseServiceKey}`,
                'Content-Type': 'image/png',
                'x-upsert': 'true',
              },
              body: binary,
            }
          )

          if (uploadRes.ok) {
            imageUrl = `${supabaseUrl}/storage/v1/object/public/creatives/${fileName}`
          }
        }

        creatives.push({
          ...brief,
          image_url: imageUrl ?? `https://placehold.co/1024x1024?text=Creative+${i + 1}`,
        })
      }
    } catch {
      // Network or parse error — use placeholder
      creatives.push({
        ...brief,
        image_url: `https://placehold.co/1024x1024?text=Creative+${i + 1}`,
      })
    }
  }

  const output = CreativeEngineResponseSchema.parse({ creatives })

  return {
    output: output as unknown as Record<string, unknown>,
    usage: {
      input_tokens: briefsResult.usage.input_tokens,
      output_tokens: briefsResult.usage.output_tokens,
      cost_usd: briefsResult.cost_usd,
    },
    mode: 'real',
  }
}
