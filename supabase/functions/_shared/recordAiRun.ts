import { getAdminClient } from './supabaseAdmin.ts'

type RunStart = {
  orchestratorName: string
  agentVersion: string
  model: string
  inputPayload: Record<string, unknown>
  userId?: string
  workspaceId?: string
  offerId?: string
  provider?: string
}

// Insert an ai_runs row at the start of an orchestrator call; returns its id.
export async function recordRunStart(args: RunStart): Promise<string> {
  const { data, error } = await getAdminClient()
    .from('ai_runs')
    .insert({
      orchestrator_name: args.orchestratorName,
      agent_version: args.agentVersion,
      model: args.model,
      provider: args.provider ?? 'anthropic',
      input_payload: args.inputPayload,
      user_id: args.userId ?? null,
      workspace_id: args.workspaceId ?? null,
      offer_id: args.offerId ?? null,
      status: 'running',
    })
    .select('id')
    .single()

  if (error) throw error
  return data.id as string
}

export async function recordRunSuccess(
  runId: string,
  args: {
    outputPayload: unknown
    validatedOutput?: unknown
    envelope?: unknown
    tokensInput?: number
    tokensOutput?: number
    estimatedCost?: number
    langfuseTraceId?: string
  }
): Promise<void> {
  await getAdminClient()
    .from('ai_runs')
    .update({
      status: 'success',
      output_payload: args.outputPayload,
      validated_output: args.validatedOutput ?? null,
      envelope: args.envelope ?? null,
      tokens_input: args.tokensInput ?? null,
      tokens_output: args.tokensOutput ?? null,
      estimated_cost: args.estimatedCost ?? null,
      langfuse_trace_id: args.langfuseTraceId ?? null,
      completed_at: new Date().toISOString(),
    })
    .eq('id', runId)
}

export async function recordRunError(
  runId: string,
  errorMessage: string
): Promise<void> {
  await getAdminClient()
    .from('ai_runs')
    .update({
      status: 'failed',
      error_message: errorMessage,
      completed_at: new Date().toISOString(),
    })
    .eq('id', runId)
}
