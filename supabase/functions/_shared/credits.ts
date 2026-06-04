import { getAdminClient } from './supabaseAdmin.ts'

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
export async function reserveCredits(
  workspaceId: string,
  action: string
): Promise<CreditHold> {
  const cost = await priceFor(action)
  if (cost <= 0) return { cost: 0, ledgerId: '' }

  const balance = await getBalance(workspaceId)
  if (balance < cost) throw new InsufficientCreditsError(balance, cost)

  const { data, error } = await getAdminClient()
    .from('credit_ledger')
    .insert({
      workspace_id: workspaceId,
      entry_type: 'used',
      amount: -cost,
      action,
      reason: `Reserved for ${action}`,
    })
    .select('id')
    .single()
  if (error) throw error
  return { cost, ledgerId: data.id as string }
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
