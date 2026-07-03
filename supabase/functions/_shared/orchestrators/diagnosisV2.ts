// DiagnosisV2Orchestrator — creative analysis + learning loop.
// DO NOT modify diagnosis.ts — this is the separate V2 orchestrator.
import Anthropic from 'npm:@anthropic-ai/sdk@^0.32.0'

import { callAnthropicWithTool } from '../anthropicJson.ts'
import { assertNotPaused } from '../killSwitch.ts'
import { loadActivePrompt } from '../loadActivePrompt.ts'
import { DiagnosisV2ResponseSchema, type DiagnosisV2Response } from '../types/diagnosisV2.ts'

export { OrchestratorPausedError } from '../killSwitch.ts'

const MODEL = 'claude-sonnet-4-6'
const TOOL_NAME = 'submit_diagnosis_v2'
const TOOL_DESCRIPTION =
  'Submit the complete creative analysis for the provided ad copy texts. Populate every field. Call this tool exactly once.'
const MAX_TOKENS = 3000

export type DiagnosisV2Input = {
  campaign: { id: string; name: string; channel?: string | null }
  rawCreativeInput: string
  images?: string[]  // base64-encoded PNG/JPG/WEBP
  metrics?: {
    ctr?: number
    cpl_usd?: number
    roas?: number
  }
}

export type DiagnosisV2Result = {
  output: DiagnosisV2Response
  usage?: { input_tokens: number; output_tokens: number; cost_usd: number }
  mode: 'real' | 'mock'
}

function mockDiagnosisV2(): DiagnosisV2Response {
  return {
    creative_analysis: [
      {
        hook: 'גילינו את הסוד שאף אחד לא מספר לך על ירידה במשקל',
        hook_type: 'curiosity',
        what_worked:
          'הסוד + הבטחה מוסתרת יוצרים סקרנות חזקה שמאלצת קליק. הטון מרגיש אינסיידרי.',
        what_didnt:
          'חסר proof element — בלי מספר או תוצאה ספציפית קשה להאמין להבטחה.',
        is_winner: true,
        winner_reason: 'Curiosity hook עם angle חזק — מתאים לבדיקה עם proof ב-V2',
      },
      {
        hook: 'כבר ניסית הכל ועדיין לא רואה תוצאות?',
        hook_type: 'pain',
        what_worked:
          'מדבר ישירות לתסכול של הקהל. Pain point ברורה ומיידית.',
        what_didnt:
          'לא מציע פתרון מיידי ב-hook עצמו — יכול לגרום להסחת דעת במקום פעולה.',
        is_winner: false,
      },
      {
        hook: '1,200 נשים ירדו 8 ק"ג תוך 60 יום עם השיטה הזו',
        hook_type: 'social_proof',
        what_worked:
          'מספרים ספציפיים יוצרים אמינות. Timeline ברור מוריד חסמי ספקנות.',
        what_didnt:
          'חסר differentiator — "השיטה הזו" לא אומר מה ייחודי בה לעומת מתחרים.',
        is_winner: true,
        winner_reason: 'Data-backed social proof — conversion rate גבוה בדרך כלל לסגמנט זה',
      },
    ],
    overall_assessment:
      'הקריאייטיב מתמקד ב-pain ו-curiosity — קהל relevant אבל המסרים צריכים יותר specificity. ה-winners מראים שהקהל מגיב לראיות מספריות.',
    next_campaign_recommendations: [
      'בנה וריאנטים עם social proof מספרי בשילוב curiosity hook',
      'הוסף before/after timeline ספציפי לכל מודעה',
      'בדוק authority hook עם שם מומחה מוכר בתחום',
    ],
    winning_hooks: [
      'גילינו את הסוד שאף אחד לא מספר לך על ירידה במשקל',
      '1,200 נשים ירדו 8 ק"ג תוך 60 יום עם השיטה הזו',
    ],
  }
}

function detectMediaType(b64: string): 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif' {
  const prefix = atob(b64.slice(0, 8))
  if (prefix.startsWith('\x89PNG')) return 'image/png'
  if (prefix.startsWith('\xFF\xD8')) return 'image/jpeg'
  if (prefix.startsWith('RIFF')) return 'image/webp'
  return 'image/png' // fallback
}

export async function runDiagnosisV2(
  input: DiagnosisV2Input
): Promise<DiagnosisV2Result> {
  await assertNotPaused('DiagnosisV2Orchestrator')

  if (!Deno.env.get('ANTHROPIC_API_KEY')) {
    return { output: mockDiagnosisV2(), mode: 'mock' }
  }

  const systemPrompt = await loadActivePrompt('DiagnosisV2Orchestrator')

  // ── Image path: multimodal message with one or more ad creative images ──────
  if (input.images && input.images.length > 0) {
    const apiKey = Deno.env.get('ANTHROPIC_API_KEY')!
    const anthropic = new Anthropic({ apiKey })

    const { zodToJsonSchema } = await import('npm:zod-to-json-schema@^3.23')

    const inputSchema = zodToJsonSchema(DiagnosisV2ResponseSchema, {
      target: 'jsonSchema7',
      $refStrategy: 'none',
    })

    const campaignContext = JSON.stringify({
      campaign: {
        id: input.campaign.id,
        name: input.campaign.name,
        channel: input.campaign.channel ?? null,
      },
      metrics: input.metrics ?? null,
    }, null, 2)

    // Build a multimodal content array: text instruction + one image block per image
    const userContent: Anthropic.MessageParam['content'] = [
      {
        type: 'text',
        text: `Analyze these ad creative images visually. For each image, extract the hook, copy structure, CTA, psychological triggers, visual style, and likely performance. Identify winners and losing elements.\n\nContext:\n${campaignContext}`,
      },
      ...input.images.map((b64): Anthropic.ImageBlockParam => ({
        type: 'image',
        source: {
          type: 'base64',
          media_type: detectMediaType(b64),
          data: b64,
        },
      })),
    ]

    const resp = await anthropic.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      tools: [{
        name: TOOL_NAME,
        description: TOOL_DESCRIPTION,
        input_schema: inputSchema as Anthropic.Tool['input_schema'],
      }],
      tool_choice: { type: 'tool', name: TOOL_NAME },
      system: systemPrompt,
      messages: [{ role: 'user', content: userContent }],
    })

    const toolUse = resp.content.find((c) => c.type === 'tool_use')
    if (!toolUse || toolUse.type !== 'tool_use') {
      throw new Error('No tool_use block in Anthropic vision response')
    }

    const parsed = DiagnosisV2ResponseSchema.safeParse(toolUse.input)
    if (!parsed.success) {
      throw new Error(`Vision response Zod validation failed: ${parsed.error.message}`)
    }

    const pricing = { input: 3, output: 15 } // claude-sonnet-4-6 per 1M tokens
    const costUsd =
      (resp.usage.input_tokens / 1_000_000) * pricing.input +
      (resp.usage.output_tokens / 1_000_000) * pricing.output

    return {
      output: parsed.data,
      usage: {
        input_tokens: resp.usage.input_tokens,
        output_tokens: resp.usage.output_tokens,
        cost_usd: costUsd,
      },
      mode: 'real',
    }
  }

  // ── Text path: standard tool-call with ad copy text ──────────────────────
  const metricsSection = input.metrics
    ? JSON.stringify(
        {
          ctr: input.metrics.ctr ?? null,
          cpl_usd: input.metrics.cpl_usd ?? null,
          roas: input.metrics.roas ?? null,
        },
        null,
        2
      )
    : 'Not provided'

  const userMessage = JSON.stringify(
    {
      campaign: {
        id: input.campaign.id,
        name: input.campaign.name,
        channel: input.campaign.channel ?? null,
      },
      metrics: metricsSection,
      ad_copy_texts: input.rawCreativeInput,
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
    responseSchema: DiagnosisV2ResponseSchema,
    maxTokens: MAX_TOKENS,
  })

  return {
    output: result.data,
    usage: {
      input_tokens: result.usage.input_tokens,
      output_tokens: result.usage.output_tokens,
      cost_usd: result.cost_usd,
    },
    mode: 'real',
  }
}
