import { getTranslations } from 'next-intl/server'

import { AdminPageHeader } from '@/components/admin/AdminPageHeader'
import { AdminRow, AdminTable } from '@/components/admin/AdminTable'
import { createClient } from '@/lib/supabase/server'

const COLS = 'minmax(0,1.3fr) 120px 110px 80px 90px 130px'
const mono = (color: string) =>
  ({ fontFamily: 'var(--font-mono)', fontSize: '12px', color, textAlign: 'right' as const })

type PromptRow = {
  id: string
  orchestrator_name: string
  prompt_type: string
  version: string
  vertical_id: string | null
  is_active: boolean
  created_at: string
  verticals: { slug: string } | null
}

export default async function PromptsPage() {
  const supabase = await createClient()
  const { data } = await supabase
    .from('prompts')
    .select(
      'id, orchestrator_name, prompt_type, version, vertical_id, is_active, created_at, verticals(slug)'
    )
    .order('orchestrator_name')
    .order('prompt_type')
    .order('created_at', { ascending: false })
    .returns<PromptRow[]>()

  const rows = data ?? []
  const t = await getTranslations('discoveryAdmin')

  return (
    <div className="flex flex-col gap-6">
      <AdminPageHeader title="PROMPTS" subtitle={t('promptsSubtitle')} />

      {rows.length === 0 ? (
        <p style={{ fontSize: '14px', color: 'var(--muted-foreground)' }}>{t('promptsEmpty')}</p>
      ) : (
        <AdminTable
          cols={COLS}
          columns={[
            { label: 'ORCHESTRATOR', ltr: true },
            { label: 'TYPE', ltr: true },
            { label: 'VERTICAL', ltr: true },
            { label: 'VERSION', ltr: true },
            { label: 'STATUS' },
            { label: 'CREATED', ltr: true },
          ]}
        >
          {rows.map((p) => (
            <AdminRow key={p.id} cols={COLS} href={`/admin/prompts/${p.id}`}>
              <span dir="ltr" style={mono('#E4E4E2')}>{p.orchestrator_name}</span>
              <span dir="ltr" style={mono('#8A8A88')}>{p.prompt_type}</span>
              <span dir="ltr" style={mono('#8A8A88')}>{p.verticals?.slug ?? 'global'}</span>
              <span dir="ltr" style={mono('#C9C9C7')}>{p.version}</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', fontSize: '12px', color: p.is_active ? 'var(--primary)' : '#7A7A78' }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: p.is_active ? 'var(--primary)' : '#4E4E4C' }} />
                {p.is_active ? 'active' : '—'}
              </span>
              <span dir="ltr" style={mono('#7A7A78')}>
                {new Date(p.created_at).toLocaleDateString()}
              </span>
            </AdminRow>
          ))}
        </AdminTable>
      )}
    </div>
  )
}
