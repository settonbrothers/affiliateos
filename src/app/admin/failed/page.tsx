import { getTranslations } from 'next-intl/server'

import { AdminCard } from '@/components/admin/AdminCard'
import { AdminPageHeader } from '@/components/admin/AdminPageHeader'
import { ReplayButton } from '@/components/admin/ReplayButton'
import { createClient } from '@/lib/supabase/server'

export default async function FailedMessagesPage() {
  const supabase = await createClient()
  const { data } = await supabase
    .from('failed_messages')
    .select(
      'id, message_type, payload, attempts, max_attempts, last_error, status, created_at'
    )
    .order('created_at', { ascending: false })
    .limit(100)
  const rows = data ?? []
  const t = await getTranslations('discoveryAdmin')

  return (
    <div className="flex flex-col gap-6">
      <AdminPageHeader title="FAILED · DLQ" subtitle={t('failedSubtitle')} />

      {rows.length === 0 ? (
        <p style={{ fontSize: '14px', color: 'var(--muted-foreground)' }}>{t('failedEmpty')}</p>
      ) : (
        <div className="flex flex-col gap-[10px]">
          {rows.map((m) => {
            const payload = (m.payload ?? {}) as { kind?: string; offer_id?: string }
            const replayable =
              m.status !== 'succeeded' &&
              m.message_type === 'ai_run' &&
              payload.kind === 'analyze-offer' &&
              !!payload.offer_id
            return (
              <AdminCard
                key={m.id}
                title={`${m.message_type}${payload.kind ? ` · ${payload.kind}` : ''}`}
                right={
                  <div className="flex items-center gap-2">
                    <span style={{ display: 'inline-block', background: '#EFEBE1', color: '#1F1B16', fontSize: '11px', fontWeight: 500, padding: '3px 9px' }}>
                      {m.status}
                    </span>
                    <ReplayButton id={m.id} replayable={replayable} />
                  </div>
                }
              >
                <p style={{ margin: 0, fontFamily: 'var(--font-mono)', fontSize: '11px', color: '#7A7A78' }}>
                  attempt {m.attempts}/{m.max_attempts} · {new Date(m.created_at).toLocaleString()}
                  {payload.offer_id ? ` · offer ${payload.offer_id.slice(0, 8)}…` : ''}
                </p>
                {m.last_error && (
                  <p style={{ margin: '8px 0 0', fontSize: '13px', color: '#C97A6E' }}>{m.last_error}</p>
                )}
              </AdminCard>
            )
          })}
        </div>
      )}
    </div>
  )
}
