import { capture, isPosthogConfigured } from './posthog.ts'
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
  const admin = getAdminClient()
  await admin
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

  // Cost/usage analytics (the M6 cost dashboard feed). Only touches the DB +
  // network when PostHog is actually configured, so unconfigured runs pay
  // nothing. Best-effort.
  if (isPosthogConfigured()) {
    try {
      const { data: run } = await admin
        .from('ai_runs')
        .select('orchestrator_name, workspace_id, user_id')
        .eq('id', runId)
        .maybeSingle()
      if (run) {
        await capture(
          run.workspace_id ?? run.user_id ?? runId,
          'ai_run_completed',
          {
            orchestrator: run.orchestrator_name,
            cost_usd: args.estimatedCost ?? 0,
            tokens_input: args.tokensInput ?? 0,
            tokens_output: args.tokensOutput ?? 0,
            run_id: runId,
          }
        )
      }
    } catch {
      // best-effort
    }
  }
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
