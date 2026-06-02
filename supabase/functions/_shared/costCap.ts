import { getAdminClient } from './supabaseAdmin.ts'

// Default daily ceiling applied when a workspace has no workspace_credit_caps
// row. Mirrors the table default in migration 0015. Safe-by-default: an
// unconfigured workspace is still budget-protected.
export const DEFAULT_DAILY_USD_CAP = 10

// Thrown when a workspace has already spent at or above its daily USD cap.
// Edge functions translate this to a 429. Non-retryable until the next UTC day.
export class DailyCapExceededError extends Error {
  constructor(
    public readonly workspaceId: string,
    public readonly spentUsd: number,
    public readonly capUsd: number
  ) {
    super(
      `Daily AI budget reached for this workspace ($${spentUsd.toFixed(2)} spent / $${capUsd.toFixed(2)} cap). ` +
        `Try again tomorrow or contact an admin to raise the cap.`
    )
    this.name = 'DailyCapExceededError'
  }
}

// Pure decision: spend at or above the cap is blocked. A cap of 0 blocks
// immediately (0 >= 0), which is the M2 "admin sets cap=0" behavior.
export function isOverDailyCap(spentUsd: number, capUsd: number): boolean {
  return spentUsd >= capUsd
}

// Start of the current UTC day as an ISO timestamp, for the "today" window.
function startOfUtcDayIso(): string {
  const now = new Date()
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  ).toISOString()
}

// Fail-fast guard. Reads the workspace's daily_usd_cap (default if absent),
// sums today's successful ai_runs.estimated_cost for the workspace, and throws
// DailyCapExceededError if the workspace is already at/over the cap.
export async function assertUnderDailyCap(workspaceId: string): Promise<void> {
  const admin = getAdminClient()

  const { data: capRow } = await admin
    .from('workspace_credit_caps')
    .select('daily_usd_cap')
    .eq('workspace_id', workspaceId)
    .maybeSingle()
  // numeric columns can arrive as string; coerce defensively.
  const cap = Number(capRow?.daily_usd_cap ?? DEFAULT_DAILY_USD_CAP)

  const { data: runRows } = await admin
    .from('ai_runs')
    .select('estimated_cost')
    .eq('workspace_id', workspaceId)
    .eq('status', 'success')
    .gte('completed_at', startOfUtcDayIso())
  const spent = (runRows ?? []).reduce(
    (sum, r) => sum + Number((r as { estimated_cost: number | null }).estimated_cost ?? 0),
    0
  )

  if (isOverDailyCap(spent, cap)) {
    throw new DailyCapExceededError(workspaceId, spent, cap)
  }
}
