import { createClient } from '@/lib/supabase/server'

// The current user's workspace id (1 user : 1 workspace in MVP).
export async function getCurrentWorkspaceId(): Promise<string | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase
    .from('workspace_members')
    .select('workspace_id')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle()
  return data?.workspace_id ?? null
}

export async function getBalance(workspaceId: string): Promise<number> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('credit_ledger')
    .select('amount')
    .eq('workspace_id', workspaceId)
  return (data ?? []).reduce((sum, r) => sum + Number(r.amount ?? 0), 0)
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
  const { data } = await supabase
    .from('credit_ledger')
    .select('id, entry_type, amount, action, reason, created_at')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false })
    .limit(limit)
    .returns<LedgerEntry[]>()
  return data ?? []
}

export async function getPricing(): Promise<
  Array<{ action: string; credits: number }>
> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('usage_pricing_rules')
    .select('action, credits')
    .order('action')
  return data ?? []
}
