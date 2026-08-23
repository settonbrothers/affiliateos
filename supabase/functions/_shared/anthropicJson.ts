import Anthropic from 'npm:@anthropic-ai/sdk@^0.32.0'
import { z, type ZodTypeAny } from 'npm:zod@^3.24.0'
import { zodToJsonSchema } from 'npm:zod-to-json-schema@^3.23'

import { logError } from './logError.ts'

// Per-model price in USD per 1M tokens.
const PRICING_USD_PER_MTOK: Record<string, { input: number; output: number }> =
  {
    'claude-sonnet-4-6': { input: 3, output: 15 },
    'claude-opus-4-6': { input: 5, output: 25 },
    'claude-haiku-4-5-20251001': { input: 1, output: 5 },
  }

export function calculateAnthropicCostUsd(
  model: string,
  usage: { input_tokens: number; output_tokens: number }
): number {
  const pricing = PRICING_USD_PER_MTOK[model]
  if (!pricing) {
    throw new Error(
      `No verified Anthropic pricing is configured for model ${model}; refusing to report zero cost.`
    )
  }
  return (
    (usage.input_tokens / 1_000_000) * pricing.input +
    (usage.output_tokens / 1_000_000) * pricing.output
  )
}

export class AnthropicValidationError extends Error {
  constructor(
    public readonly zodError: z.ZodError,
    public readonly rawInput: unknown,
    public readonly usage: { input_tokens: number; output_tokens: number },
    public readonly costUsd: number
  ) {
    super(
      `Anthropic tool_use output failed Zod validation: ${zodError.message}`
    )
    this.name = 'AnthropicValidationError'
  }
}

export type CallOptions<T extends ZodTypeAny> = {
  model: string
  systemPrompt: string
  userMessage: string | unknown[]
  toolName: string
  toolDescription: string
  responseSchema: T
  inputNormalizer?: (rawInput: unknown) => unknown
  maxTokens?: number
  maxRetries?: number
}

export type CallResult<T extends ZodTypeAny> = {
  data: z.infer<T>
  usage: { input_tokens: number; output_tokens: number }
  cost_usd: number
  raw_input: unknown
}

// Wrapper around Anthropic Messages API with forced tool use. Guarantees:
// - The model is forced to call exactly one tool whose input matches the
//   provided Zod schema (via zod-to-json-schema → JSON Schema input_schema).
// - The returned tool_use.input is re-validated with Zod (defense in depth).
// - 429 + 5xx + Zod validation failures retry up to maxRetries (default 3)
//   with exponential backoff.
// - Cost is computed from usage tokens × PRICING_USD_PER_MTOK[model].
export async function callAnthropicWithTool<T extends ZodTypeAny>(
  args: CallOptions<T>
): Promise<CallResult<T>> {
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY is not set in the function environment')
  }
  // Fail before making a paid request when the selected model cannot be
  // priced. A silent $0 would also disable the agency cost cap.
  calculateAnthropicCostUsd(args.model, {
    input_tokens: 0,
    output_tokens: 0,
  })

  const anthropic = new Anthropic({ apiKey })

  const inputSchema = zodToJsonSchema(args.responseSchema, {
    target: 'jsonSchema7',
    $refStrategy: 'none',
  })

  const tool: Anthropic.Tool = {
    name: args.toolName,
    description: args.toolDescription,
    input_schema: inputSchema as Anthropic.Tool['input_schema'],
  }

  const maxRetries = args.maxRetries ?? 3
  let attempt = 0
  let lastError: unknown
  const cumulativeUsage = { input_tokens: 0, output_tokens: 0 }

  // Conversation state. On a Zod validation failure we append the model's
  // invalid tool_use plus a tool_result describing the error, so the retry can
  // actually correct it instead of re-sending the identical prompt (which yields
  // the identical invalid output when the model is deterministic on this input).
  const messages: Anthropic.MessageParam[] = [
    {
      role: 'user',
      content: args.userMessage as Anthropic.MessageParam['content'],
    },
  ]

  while (attempt < maxRetries) {
    attempt++
    try {
      const resp = await anthropic.messages.create({
        model: args.model,
        max_tokens: args.maxTokens ?? 4096,
        tools: [tool],
        tool_choice: { type: 'tool', name: args.toolName },
        system: args.systemPrompt,
        messages,
      })

      const toolUse = resp.content.find((c) => c.type === 'tool_use')
      if (!toolUse || toolUse.type !== 'tool_use') {
        throw new Error('No tool_use block in Anthropic response')
      }

      cumulativeUsage.input_tokens += resp.usage.input_tokens
      cumulativeUsage.output_tokens += resp.usage.output_tokens
      const normalizedInput = args.inputNormalizer
        ? args.inputNormalizer(toolUse.input)
        : toolUse.input
      const parsed = args.responseSchema.safeParse(normalizedInput)
      if (!parsed.success) {
        // Feed the failure back into the conversation so the next attempt fixes
        // the specific problem (e.g. "angles must contain at least 2 items").
        messages.push({ role: 'assistant', content: resp.content })
        messages.push({
          role: 'user',
          content: [
            {
              type: 'tool_result',
              tool_use_id: toolUse.id,
              is_error: true,
              content:
                `Your submission failed schema validation: ${parsed.error.message} ` +
                `Call ${args.toolName} again with a corrected submission that satisfies ` +
                `every constraint (including array minimum/maximum item counts).`,
            },
          ],
        })
        throw new AnthropicValidationError(
          parsed.error,
          toolUse.input,
          { ...cumulativeUsage },
          calculateAnthropicCostUsd(args.model, cumulativeUsage)
        )
      }

      const costUsd = calculateAnthropicCostUsd(args.model, cumulativeUsage)

      return {
        data: parsed.data,
        usage: {
          input_tokens: cumulativeUsage.input_tokens,
          output_tokens: cumulativeUsage.output_tokens,
        },
        cost_usd: costUsd,
        raw_input: toolUse.input,
      }
    } catch (err) {
      lastError = err

      const status = (err as { status?: number }).status
      const isRetryable =
        err instanceof AnthropicValidationError ||
        status === 429 ||
        (status !== undefined && status >= 500)

      if (!isRetryable || attempt >= maxRetries) {
        await logError({
          severity: 'error',
          source: 'anthropic:callWithTool',
          message: err instanceof Error ? err.message : String(err),
          context: {
            model: args.model,
            attempt,
            toolName: args.toolName,
            status,
            rawInputShape:
              err instanceof AnthropicValidationError
                ? describeToolInput(err.rawInput)
                : null,
            failedUsage:
              err instanceof AnthropicValidationError ? err.usage : null,
            failedCostUsd:
              err instanceof AnthropicValidationError ? err.costUsd : null,
          },
        })
        throw err
      }

      // Exponential backoff: 1s, 2s, 4s, ...
      await new Promise((resolve) =>
        setTimeout(resolve, 1000 * Math.pow(2, attempt - 1))
      )
    }
  }

  throw lastError ?? new Error('Anthropic call failed after retries')
}

function describeToolInput(value: unknown): Record<string, unknown> {
  if (Array.isArray(value)) return { type: 'array', length: value.length }
  if (value && typeof value === 'object') {
    return { type: 'object', keys: Object.keys(value as object).sort() }
  }
  return { type: typeof value }
}
