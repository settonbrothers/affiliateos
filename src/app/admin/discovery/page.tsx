import { getTranslations } from 'next-intl/server'
import Link from 'next/link'

import { AdminPageHeader } from '@/components/admin/AdminPageHeader'
import { AdminRow, AdminTable } from '@/components/admin/AdminTable'
import { StartScanForm } from '@/components/discovery/StartScanForm'
import { listDiscoveryRuns } from '@/lib/queries/discovery'
import { listVerticals } from '@/lib/queries/offers'

const COLS = 'minmax(0,1fr) 110px 160px 90px'
const mono = (color: string) =>
  ({ fontFamily: 'var(--font-mono)', fontSize: '12px', color, textAlign: 'right' as const })

export default async function DiscoveryPage() {
  const [runs, verticals] = await Promise.all([
    listDiscoveryRuns(),
    listVerticals(),
  ])
  const t = await getTranslations('discoveryAdmin')

  return (
    <div className="flex flex-col gap-6">
      <AdminPageHeader title="DISCOVERY" subtitle={t('discoverySubtitle')} />
      <StartScanForm
        verticals={verticals.map((v) => ({ id: v.id, name: v.name }))}
      />

      {runs.length === 0 ? (
        <p style={{ fontSize: '14px', color: 'var(--muted-foreground)' }}>{t('noScans')}</p>
      ) : (
        <AdminTable
          cols={COLS}
          columns={[
            { label: 'STARTED', ltr: true },
            { label: 'STATUS' },
            { label: 'DISCOVERED → ANALYZED → APPROVED', ltr: true },
            { label: 'COST', ltr: true },
          ]}
        >
          {runs.map((r) => (
            <AdminRow key={r.id} cols={COLS} href={`/admin/discovery/${r.id}`}>
              <span dir="ltr" style={mono('#E4E4E2')}>{new Date(r.created_at).toLocaleString()}</span>
              <span style={{ fontSize: '12px', color: '#C9C9C7' }}>{r.status}</span>
              <span dir="ltr" style={mono('#8A8A88')}>
                {r.counts?.discovered ?? 0} → {r.counts?.analyzed ?? 0} → {r.counts?.approved ?? 0}
              </span>
              <span dir="ltr" style={mono('#C9C9C7')}>${(r.total_cost_usd ?? 0).toFixed(2)}</span>
            </AdminRow>
          ))}
        </AdminTable>
      )}

      <Link href="/admin/discovery/sources" style={{ fontSize: '13px', color: '#9A6B00', textDecoration: 'underline' }}>
        {t('manageSources')}
      </Link>
    </div>
  )
}
