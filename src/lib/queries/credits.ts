import { createClient } from '@/lib/supabase/server'

// The current user's workspace id (1 user : 1 workspace in MVP).
export async function getCurrentWorkspaceId(): Promise<string | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null
  const { data, error } = await supabase
    .from('workspace_members')
    .select('workspace_id')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle()
  if (error) console.error('[queries/credits] DB error:', error)
  return data?.workspace_id ?? null
}

export async function getBalance(workspaceId: string): Promise<number> {
  const supabase = await createClient()
  // Use PostgREST aggregate to compute the sum server-side, avoiding the
  // 1000-row client-side truncation that the previous .reduce() approach had.
  const { data, error } = await supabase
    .from('credit_ledger')
    .select('amount.sum()')
    .eq('workspace_id', workspaceId)
    .returns<[{ sum: number | null }]>()
    .single()
  if (error) {
    // Fallback: fetch all rows explicitly (no implicit 1000 cap via .throwOnError)
    const { data: rows, error: rowsError } = await supabase
      .from('credit_ledger')
      .select('amount')
      .eq('workspace_id', workspaceId)
      .limit(10000)
    if (rowsError) throw new Error(rowsError.message)
    return (rows ?? []).reduce((sum, r) => sum + Number(r.amount ?? 0), 0)
  }
  return Number(data?.sum ?? 0)
}

// Current user's balance, or null if no workspace.
export async function getCurrentBalance(): Promise<number | null> {
  const wsId = await getCurrentWorkspaceId()
  if (!wsId) return null
  return getBalance(wsId)
}

export type LedgerEntry = {
  id: string
  entry_type: string
  amount: number
  action: string | null
  reason: string | null
  created_at: string
}

export async function getLedger(
  workspaceId: string,
  limit = 50
): Promise<LedgerEntry[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('credit_ledger')
    .select('id, entry_type, amount, action, reason, created_at')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false })
    .limit(limit)
    .returns<LedgerEntry[]>()
  if (error) console.error('[queries/credits] DB error:', error)
  return data ?? []
}

export async function getPricing(): Promise<
  Array<{ action: string; credits: number }>
> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('usage_pricing_rules')
    .select('action, credits')
    .order('action')
  if (error) console.error('[queries/credits] DB error:', error)
  return data ?? []
}
