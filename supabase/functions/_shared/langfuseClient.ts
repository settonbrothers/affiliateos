// Minimal Langfuse ingestion client (fire-and-forget). Mirrors the pattern from
// richer-ai-agents-hub. Observability must never block or fail a request.

type TraceArgs = {
  name: string
  userId?: string
  sessionId?: string
  metadata?: Record<string, unknown>
}

type GenerationArgs = {
  traceId: string
  name: string
  model: string
  input: unknown
  output: unknown
  promptTokens: number
  completionTokens: number
  costUsd: number
  startTime: Date
  endTime: Date
}

const PRICING_USD_PER_MTOK: Record<string, { input: number; output: number }> = {
  'claude-sonnet-4-6': { input: 3, output: 15 },
  'claude-haiku-4-5-20251001': { input: 1, output: 5 },
}

export function computeCostUsd(
  model: string,
  promptTok: number,
  completionTok: number
): number {
  const p = PRICING_USD_PER_MTOK[model]
  if (!p) return 0
  return (promptTok / 1_000_000) * p.input + (completionTok / 1_000_000) * p.output
}

export async function createTrace(args: TraceArgs): Promise<string> {
  const traceId = crypto.randomUUID()
  await postIngest({
    type: 'trace-create',
    body: {
      id: traceId,
      name: args.name,
      userId: args.userId,
      sessionId: args.sessionId,
      metadata: args.metadata,
      timestamp: new Date().toISOString(),
    },
  })
  return traceId
}

export async function recordGeneration(args: GenerationArgs): Promise<void> {
  await postIngest({
    type: 'generation-create',
    body: {
      id: crypto.randomUUID(),
      traceId: args.traceId,
      name: args.name,
      model: args.model,
      input: args.input,
      output: args.output,
      usage: {
        promptTokens: args.promptTokens,
        completionTokens: args.completionTokens,
        totalCost: args.costUsd,
      },
      startTime: args.startTime.toISOString(),
      endTime: args.endTime.toISOString(),
    },
  })
}

async function postIngest(body: unknown): Promise<void> {
  const auth = btoa(
    `${Deno.env.get('LANGFUSE_PUBLIC_KEY')}:${Deno.env.get('LANGFUSE_SECRET_KEY')}`
  )
  try {
    await fetch(`${Deno.env.get('LANGFUSE_HOST')}/api/public/ingestion`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${auth}`,
      },
      body: JSON.stringify({ batch: [body] }),
    })
  } catch (err) {
    // fire-and-forget; never block on observability
    console.error('langfuse ingest failed', err)
  }
}
