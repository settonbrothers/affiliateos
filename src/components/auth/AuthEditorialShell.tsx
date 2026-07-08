import { Check, Lock, TrendingUp } from 'lucide-react'
import { getTranslations } from 'next-intl/server'
import type { ReactNode } from 'react'

import { EditorialSurface } from '@/components/brand/editorial/EditorialSurface'

/**
 * The auth "Selezione" split: a white editorial statement panel beside the
 * form on a light card. Statement copy is passed in so /login and /signup
 * share one shell.
 */
export async function AuthEditorialShell({
  statement,
  form,
}: {
  statement: string
  form: ReactNode
}) {
  const t = await getTranslations('auth')
  const trust = [
    { Icon: TrendingUp, label: t('trustEvidence') },
    { Icon: Lock, label: t('trustPrivate') },
    { Icon: Check, label: t('trustSpeed') },
  ]
  return (
    <main className="affex-auth-grid">
      <EditorialSurface
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          gap: '28px',
        }}
      >
        <div dir="ltr" style={{ display: 'flex', alignItems: 'baseline', gap: '1px' }}>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: '22px', fontWeight: 700, color: '#1F1B16' }}>
            AFF
          </span>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: '22px', fontWeight: 700, color: '#9A6B00' }}>
            EX
          </span>
        </div>
        <div
          dir="ltr"
          style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', letterSpacing: '0.2em', color: '#8A8375' }}
        >
          {t('kicker')}
        </div>
        <h1
          style={{
            margin: 0,
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(34px,4.5vw,56px)',
            fontWeight: 600,
            lineHeight: 1.02,
            color: '#1F1B16',
            maxWidth: '18ch',
          }}
        >
          {statement}
        </h1>
        <div
          style={{
            borderTop: '1px solid #DED8CB',
            paddingTop: '20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}
        >
          {trust.map(({ Icon, label }) => (
            <div
              key={label}
              style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13.5px', color: '#6B6459' }}
            >
              <Icon size={16} strokeWidth={2} color="#9A6B00" />
              {label}
            </div>
          ))}
        </div>
      </EditorialSurface>
      <div
        className="affex-doc affex-auth-form"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 'clamp(28px,4vw,52px) clamp(24px,4vw,48px)',
          background: '#F6F4EF',
          borderInlineStart: '1px solid #DED8CB',
        }}
      >
        <div style={{ width: '100%', maxWidth: '400px' }}>{form}</div>
      </div>
    </main>
  )
}
