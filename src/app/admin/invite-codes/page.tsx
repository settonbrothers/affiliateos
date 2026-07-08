import { getTranslations } from 'next-intl/server'

import { AdminPageHeader } from '@/components/admin/AdminPageHeader'
import { GenerateInviteForm } from '@/components/admin/GenerateInviteForm'
import { RevokeInviteButton } from '@/components/admin/RevokeInviteButton'
import { createClient } from '@/lib/supabase/server'

type CodeRow = {
  id: string
  code: string
  bonus_credits: number
  max_uses: number
  uses: number
  expires_at: string | null
  revoked: boolean
  created_at: string
}

const GRID = 'minmax(0,1fr) 90px 90px 130px'

export default async function InviteCodesPage() {
  const supabase = await createClient()
  const { data } = await supabase
    .from('invite_codes')
    .select(
      'id, code, bonus_credits, max_uses, uses, expires_at, revoked, created_at'
    )
    .order('created_at', { ascending: false })
    .returns<CodeRow[]>()

  const rows = data ?? []
  const now = Date.now()
  const t = await getTranslations('discoveryAdmin')

  return (
    <div className="flex flex-col gap-6">
      <AdminPageHeader title="INVITE CODES" subtitle={t('inviteSubtitle')} />

      <div style={{ border: '1px solid rgba(255,255,255,0.1)', background: '#0C0C0C', padding: '18px 22px' }}>
        <GenerateInviteForm />
      </div>

      {rows.length === 0 ? (
        <p style={{ fontSize: '14px', color: 'var(--muted-foreground)' }}>{t('inviteEmpty')}</p>
      ) : (
        <div>
          <div
            dir="rtl"
            style={{
              display: 'grid',
              gridTemplateColumns: GRID,
              gap: '16px',
              padding: '12px',
              fontFamily: 'var(--font-mono)',
              fontSize: '9.5px',
              letterSpacing: '0.1em',
              color: '#5E5E5C',
              borderBottom: '1px solid rgba(255,255,255,0.09)',
            }}
          >
            <span>{t('colCode')}</span>
            <span>{t('colBonus')}</span>
            <span>{t('colUses')}</span>
            <span>{t('colStatus')}</span>
          </div>
          {rows.map((c) => {
            const expired = !!c.expires_at && new Date(c.expires_at).getTime() < now
            const used = c.uses >= c.max_uses
            const status = c.revoked
              ? 'revoked'
              : expired
                ? 'expired'
                : used
                  ? 'used up'
                  : 'active'
            const active = status === 'active'
            return (
              <div
                key={c.id}
                dir="rtl"
                className="affex-trow"
                style={{
                  display: 'grid',
                  gridTemplateColumns: GRID,
                  gap: '16px',
                  padding: '15px 12px',
                  borderBottom: '1px solid rgba(255,255,255,0.06)',
                  alignItems: 'center',
                }}
              >
                <span dir="ltr" style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', color: 'var(--primary)', textAlign: 'right', letterSpacing: '0.08em' }}>
                  {c.code}
                </span>
                <span dir="ltr" style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: '#C9C9C7', textAlign: 'right' }}>
                  +{c.bonus_credits}
                </span>
                <span dir="ltr" style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: '#8A8A88', textAlign: 'right' }}>
                  {c.uses}/{c.max_uses}
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', fontSize: '12px', color: active ? 'var(--primary)' : '#7A7A78' }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: active ? 'var(--primary)' : '#4E4E4C' }} />
                  {status}
                  {active && (
                    <span style={{ marginInlineStart: 'auto' }}>
                      <RevokeInviteButton id={c.id} />
                    </span>
                  )}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
