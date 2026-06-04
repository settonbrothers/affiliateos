import { GrantCreditsButton } from '@/components/billing/GrantCreditsButton'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { isCurrentUserAdmin } from '@/lib/auth/role'
import {
  getBalance,
  getCurrentWorkspaceId,
  getLedger,
  getPricing,
} from '@/lib/queries/credits'

function fmtAmount(n: number) {
  return n > 0 ? `+${n}` : `${n}`
}

export default async function BillingPage() {
  const workspaceId = await getCurrentWorkspaceId()
  const [balance, ledger, pricing, isAdmin] = await Promise.all([
    workspaceId ? getBalance(workspaceId) : Promise.resolve(0),
    workspaceId ? getLedger(workspaceId) : Promise.resolve([]),
    getPricing(),
    isCurrentUserAdmin(),
  ])

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Billing & credits</h1>
        <p className="text-sm text-[var(--color-muted-foreground)]">
          Each AI action spends credits. Failed runs are automatically refunded.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-[var(--color-muted-foreground)]">
            Current balance
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-end justify-between gap-4">
          <span className="text-4xl font-bold">{balance}</span>
          {isAdmin && <GrantCreditsButton />}
        </CardContent>
      </Card>

      <div>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-[var(--color-muted-foreground)]">
          Pricing
        </h2>
        <div className="flex flex-wrap gap-2 text-sm">
          {pricing.map((p) => (
            <Badge key={p.action}>
              {p.action}: {p.credits}
            </Badge>
          ))}
        </div>
      </div>

      <div>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-[var(--color-muted-foreground)]">
          History
        </h2>
        {ledger.length === 0 ? (
          <p className="text-sm text-[var(--color-muted-foreground)]">
            No credit activity yet.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)] text-left">
                <th className="py-2 font-medium">When</th>
                <th className="py-2 font-medium">Type</th>
                <th className="py-2 font-medium">Detail</th>
                <th className="py-2 text-right font-medium">Amount</th>
              </tr>
            </thead>
            <tbody>
              {ledger.map((e) => (
                <tr key={e.id} className="border-b border-[var(--color-border)]">
                  <td className="py-2 text-[var(--color-muted-foreground)]">
                    {new Date(e.created_at).toLocaleString()}
                  </td>
                  <td className="py-2">{e.entry_type}</td>
                  <td className="py-2 text-[var(--color-muted-foreground)]">
                    {e.action ?? e.reason ?? '—'}
                  </td>
                  <td
                    className={`py-2 text-right tabular-nums ${e.amount < 0 ? 'text-red-700' : 'text-green-700'}`}
                  >
                    {fmtAmount(e.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
