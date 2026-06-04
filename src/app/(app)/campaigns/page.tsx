import Link from 'next/link'

import { Badge } from '@/components/ui/badge'
import { listCampaigns } from '@/lib/queries/campaigns'

export default async function CampaignsPage() {
  const campaigns = await listCampaigns()

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Campaigns</h1>
        <p className="text-sm text-[var(--color-muted-foreground)]">
          Real campaigns you ran against a test kit. Enter results, then get a
          diagnosis.
        </p>
      </div>

      {campaigns.length === 0 ? (
        <p className="text-sm text-[var(--color-muted-foreground)]">
          No campaigns yet. Open an offer → Test Kit tab → generate a kit →{' '}
          <strong>Create campaign from this kit</strong>.
        </p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--color-border)] text-left">
              <th className="py-2 font-medium">Campaign</th>
              <th className="py-2 font-medium">Offer</th>
              <th className="py-2 font-medium">Channel</th>
              <th className="py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {campaigns.map((c) => (
              <tr key={c.id} className="border-b border-[var(--color-border)]">
                <td className="py-2">
                  <Link href={`/campaigns/${c.id}`} className="underline">
                    {c.name}
                  </Link>
                </td>
                <td className="py-2 text-[var(--color-muted-foreground)]">
                  {c.offers?.name ?? '—'}
                </td>
                <td className="py-2 text-[var(--color-muted-foreground)]">
                  {c.channel ?? '—'}
                </td>
                <td className="py-2">
                  <Badge>{c.status}</Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
