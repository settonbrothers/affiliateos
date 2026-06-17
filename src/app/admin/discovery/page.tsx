import { getTranslations } from 'next-intl/server'
import Link from 'next/link'

import { StartScanForm } from '@/components/discovery/StartScanForm'
import { listDiscoveryRuns } from '@/lib/queries/discovery'
import { listVerticals } from '@/lib/queries/offers'

export default async function DiscoveryPage() {
  const [runs, verticals] = await Promise.all([
    listDiscoveryRuns(),
    listVerticals(),
  ])
  const t = await getTranslations('discoveryAdmin')

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">{t('title')}</h1>
      <StartScanForm
        verticals={verticals.map((v) => ({ id: v.id, name: v.name }))}
      />

      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[var(--color-border)] text-start">
            <th className="py-2 font-medium">{t('colStarted')}</th>
            <th className="py-2 font-medium">{t('colStatus')}</th>
            <th className="py-2 font-medium">{t('colFunnel')}</th>
            <th className="py-2 font-medium">{t('colCost')}</th>
          </tr>
        </thead>
        <tbody>
          {runs.map((r) => (
            <tr key={r.id} className="border-b border-[var(--color-border)]">
              <td className="py-2">
                <Link href={`/admin/discovery/${r.id}`} className="underline">
                  {new Date(r.created_at).toLocaleString()}
                </Link>
              </td>
              <td className="py-2">{r.status}</td>
              <td className="py-2 text-[var(--color-muted-foreground)]">
                {r.counts?.discovered ?? 0} → {r.counts?.analyzed ?? 0} →{' '}
                {r.counts?.approved ?? 0}
              </td>
              <td className="py-2 text-[var(--color-muted-foreground)]">
                ${(r.total_cost_usd ?? 0).toFixed(2)}
              </td>
            </tr>
          ))}
          {runs.length === 0 && (
            <tr>
              <td
                colSpan={4}
                className="py-3 text-[var(--color-muted-foreground)]"
              >
                {t('noScans')}
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <Link href="/admin/discovery/sources" className="text-sm underline">
        {t('manageSources')}
      </Link>
    </div>
  )
}
