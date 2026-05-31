import { getAdminClient } from './supabaseAdmin.ts'

// Thrown when an orchestrator's row in agent_kill_switches has is_paused=true.
// Edge functions translate this to a 503 with the reason; record-and-replay
// flows treat it as a non-retryable terminal state.
export class OrchestratorPausedError extends Error {
  constructor(
    public readonly orchestratorName: string,
    public readonly reason: string | null
  ) {
    super(
      `Orchestrator ${orchestratorName} is paused${reason ? `: ${reason}` : ''}`
    )
    this.name = 'OrchestratorPausedError'
  }
}

export async function assertNotPaused(orchestratorName: string): Promise<void> {
  const { data } = await getAdminClient()
    .from('agent_kill_switches')
    .select('is_paused, reason')
    .eq('orchestrator_name', orchestratorName)
    .maybeSingle()
  if (data?.is_paused) {
    throw new OrchestratorPausedError(orchestratorName, data.reason)
  }
}
