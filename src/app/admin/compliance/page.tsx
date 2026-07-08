import { getTranslations } from 'next-intl/server'

import { AdminCard } from '@/components/admin/AdminCard'
import { AdminPageHeader } from '@/components/admin/AdminPageHeader'
import { createClient } from '@/lib/supabase/server'

type RuleRow = {
  id: string
  rule_type: string
  title: string
  detail: string
  severity: string
  channel: string | null
  verticals: { slug: string; name: string } | null
}

export default async function CompliancePage() {
  const supabase = await createClient()
  const { data } = await supabase
    .from('compliance_rules')
    .select('id, rule_type, title, detail, severity, channel, verticals(slug, name)')
    .order('severity', { ascending: false })
    .returns<RuleRow[]>()

  const rows = data ?? []
  const byVertical = new Map<string, RuleRow[]>()
  for (const r of rows) {
    const key = r.verticals?.name ?? 'All verticals'
    const arr = byVertical.get(key) ?? []
    arr.push(r)
    byVertical.set(key, arr)
  }

  const t = await getTranslations('discoveryAdmin')

  return (
    <div className="flex flex-col gap-6">
      <AdminPageHeader title="COMPLIANCE" subtitle={t('complianceSubtitle')} />

      {rows.length === 0 ? (
        <p style={{ fontSize: '14px', color: 'var(--muted-foreground)' }}>{t('complianceEmpty')}</p>
      ) : (
        [...byVertical.entries()].map(([vertical, rules]) => (
          <AdminCard key={vertical} title={vertical}>
            <div className="flex flex-col gap-3">
              {rules.map((r) => (
                <div key={r.id} className="flex flex-col gap-0.5">
                  <div className="flex items-center gap-2">
                    <span style={{ fontSize: '14px', fontWeight: 500, color: '#FFFFFF' }}>{r.title}</span>
                    <span style={{ display: 'inline-block', background: '#EFEBE1', color: '#1F1B16', fontSize: '11px', fontWeight: 500, padding: '2px 8px' }}>
                      {r.severity}
                    </span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: '#7A7A78' }}>{r.rule_type}</span>
                  </div>
                  <p style={{ margin: 0, fontSize: '13px', color: '#8A8A88' }}>{r.detail}</p>
                </div>
              ))}
            </div>
          </AdminCard>
        ))
      )}
    </div>
  )
}
