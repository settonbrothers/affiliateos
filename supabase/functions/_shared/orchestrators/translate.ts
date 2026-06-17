import { callAnthropicWithTool } from '../anthropicJson.ts'
import { assertNotPaused } from '../killSwitch.ts'
import { loadActivePrompt } from '../loadActivePrompt.ts'
import { mockTranslate } from '../mockAi.ts'
import { TranslateResponseSchema } from '../types/translate.ts'

const MODEL = 'claude-haiku-4-5-20251001'
const TOOL_NAME = 'submit_translation'
const TOOL_DESCRIPTION =
  'Submit the translation of every input item, matched by id. Call exactly once.'

const LOCALE_NAMES: Record<string, string> = { he: 'Hebrew', en: 'English' }

export type TranslateItemInput = { id: string; text: string }

export type OrchestratorResult = {
  output: Record<string, unknown>
  usage?: { input_tokens: number; output_tokens: number; cost_usd: number }
  mode: 'real' | 'mock'
}

export async function runTranslate(
  items: TranslateItemInput[],
  locale: string
): Promise<OrchestratorResult> {
  await assertNotPaused('TranslateOrchestrator')

  if (!Deno.env.get('ANTHROPIC_API_KEY')) {
    return { output: mockTranslate(items), mode: 'mock' }
  }

  const systemPrompt = await loadActivePrompt('TranslateOrchestrator')
  const userMessage = JSON.stringify(
    {
      target_language: LOCALE_NAMES[locale] ?? locale,
      instructions:
        'Translate each item.text into the target language for an expert affiliate-marketing audience. Keep brand names, product names, numbers, currencies, and units as-is. Return one item per input, matched by id, with the translated text.',
      items,
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
    responseSchema: TranslateResponseSchema,
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
