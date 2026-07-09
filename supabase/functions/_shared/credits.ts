import { sendEmail } from './email.ts'
import { getAdminClient } from './supabaseAdmin.ts'

// Email the workspace owner once when a debit takes them below this balance.
const LOW_CREDIT_THRESHOLD = 10

async function notifyLowCredits(
  workspaceId: string,
  newBalance: number
): Promise<void> {
  // Fully best-effort: a low-credit warning must never break a paid action.
  try {
    const admin = getAdminClient()
    const { data: ws } = await admin
      .from('workspaces')
      .select('created_by')
      .eq('id', workspaceId)
      .maybeSingle()
    if (!ws?.created_by) return
    const { data: profile } = await admin
      .from('profiles')
      .select('email')
      .eq('id', ws.created_by)
      .maybeSingle()
    await sendEmail(
      profile?.email,
      "You're low on AffiliateOS credits",
      `<p>Your workspace is down to <strong>${newBalance} credits</strong>. ` +
        `Top up or subscribe from the billing page so your analyses don't get interrupted.</p>`
    )
  } catch {
    // ignore
  }
}

// Fallback prices if usage_pricing_rules is missing a row. Mirrors the seed in
// migration 0025.
const DEFAULT_PRICES: Record<string, number> = {
  'analyze-offer': 5,
  'generate-test-kit': 10,
  'diagnose-results': 5,
  'check-compliance': 2,
}

export class InsufficientCreditsError extends Error {
  constructor(
    public readonly balance: number,
    public readonly cost: number
  ) {
    super(
      `Not enough credits — this action costs ${cost} and you have ${balance}. ` +
        `Add credits to continue.`
    )
    this.name = 'InsufficientCreditsError'
  }
}

export type CreditHold = { cost: number; ledgerId: string }

async function priceFor(action: string): Promise<number> {
  const { data } = await getAdminClient()
    .from('usage_pricing_rules')
    .select('credits')
    .eq('action', action)
    .maybeSingle()
  return Number(data?.credits ?? DEFAULT_PRICES[action] ?? 0)
}

export async function getBalance(workspaceId: string): Promise<number> {
  const { data } = await getAdminClient()
    .from('credit_ledger')
    .select('amount')
    .eq('workspace_id', workspaceId)
  return (data ?? []).reduce(
    (sum, r) => sum + Number((r as { amount: number }).amount ?? 0),
    0
  )
}

// Reserve credits for an action by writing a debit BEFORE the LLM call.
// Throws InsufficientCreditsError when the balance can't cover the cost.
// Uses an atomic Postgres RPC (reserve_credits) that holds a row-level lock
// during the balance check + insert, eliminating the TOCTOU race condition.
export async function reserveCredits(
  workspaceId: string,
  action: string
): Promise<CreditHold> {
  const cost = await priceFor(action)
  if (cost <= 0) return { cost: 0, ledgerId: '' }

  // Read the balance for the threshold check (best-effort, non-critical).
  const balance = await getBalance(workspaceId)

  // reserve_credits atomically checks the balance and writes the debit under a
  // per-workspace lock, returning the new ledger row id (or NULL when short).
  const { data: reservedId, error: rpcError } = await getAdminClient().rpc(
    'reserve_credits',
    {
      p_workspace_id: workspaceId,
      p_amount: cost,
      p_description: `Reserved for ${action}`,
    }
  )
  if (rpcError) throw rpcError
  if (!reservedId) throw new InsufficientCreditsError(balance, cost)

  // Warn the owner once, on the debit that crosses below the threshold.
  const newBalance = balance - cost
  if (balance >= LOW_CREDIT_THRESHOLD && newBalance < LOW_CREDIT_THRESHOLD) {
    await notifyLowCredits(workspaceId, newBalance)
  }

  return { cost, ledgerId: reservedId as string }
}

// Link a reservation to its ai_run once the run row exists (traceability).
export async function linkCreditToRun(
  hold: CreditHold | null,
  aiRunId: string
): Promise<void> {
  if (!hold || !hold.ledgerId) return
  await getAdminClient()
    .from('credit_ledger')
    .update({ ai_run_id: aiRunId })
    .eq('id', hold.ledgerId)
}

// Refund a reserved hold (action failed). Writes a positive 'refunded' entry.
export async function refundCredits(
  workspaceId: string,
  hold: CreditHold | null,
  action: string,
  aiRunId?: string
): Promise<void> {
  if (!hold || hold.cost <= 0) return
  await getAdminClient().from('credit_ledger').insert({
    workspace_id: workspaceId,
    entry_type: 'refunded',
    amount: hold.cost,
    action,
    ai_run_id: aiRunId ?? null,
    reason: `Refund — ${action} failed`,
  })
}
