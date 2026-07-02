import { getOfferNetworkData } from '@/lib/queries/offers'

interface Props {
  offerId: string
}

export async function NetworkComparisonCard({ offerId }: Props) {
  const networks = await getOfferNetworkData(offerId)

  if (networks.length === 0) {
    return (
      <div className="rounded-lg border bg-muted/40 p-4 text-sm text-muted-foreground">
        עוד לא נמצאו רשתות — הanalyzer יעדכן אחרי הdiscovery הבא
      </div>
    )
  }

  return (
    <div className="rounded-lg border bg-card p-4">
      <h3 className="mb-3 text-sm font-semibold text-foreground">השוואת רשתות</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-xs text-muted-foreground">
              <th className="pb-2 text-right font-medium">רשת</th>
              <th className="pb-2 text-right font-medium">EPC</th>
              <th className="pb-2 text-right font-medium">סוג עמלה</th>
              <th className="pb-2 text-right font-medium">תשלום</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {networks.map((n) => (
              <tr key={n.id} className="py-2">
                <td className="py-2 text-right">
                  <span className="flex items-center gap-1.5 justify-end">
                    {n.network_url ? (
                      <a
                        href={n.network_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium text-primary hover:underline"
                      >
                        {n.network_name}
                      </a>
                    ) : (
                      <span className="font-medium">{n.network_name}</span>
                    )}
                    {n.is_recommended && (
                      <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                        מומלץ
                      </span>
                    )}
                  </span>
                </td>
                <td className="py-2 text-right text-muted-foreground">
                  {n.epc_usd != null ? `$${Number(n.epc_usd).toFixed(2)}` : '—'}
                </td>
                <td className="py-2 text-right text-muted-foreground">
                  {n.commission_type ?? '—'}
                </td>
                <td className="py-2 text-right text-muted-foreground">
                  {n.payout_usd != null ? `$${Number(n.payout_usd).toFixed(2)}` : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
