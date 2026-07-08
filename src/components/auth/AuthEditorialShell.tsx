import { Check, Lock, TrendingUp } from 'lucide-react'
import { getTranslations } from 'next-intl/server'
import type { ReactNode } from 'react'

/**
 * The auth split: a dark editorial statement panel (the dramatic "hero", like
 * the campaign hero band) beside the form on a light off-white panel. Dark +
 * light combined for weight — not a flat all-white page. Statement copy is
 * passed in so /login and /signup share one shell.
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
      {/* Left — dark statement panel */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          gap: '28px',
          padding: 'clamp(28px,4vw,56px) clamp(24px,4vw,52px)',
          background: 'radial-gradient(100% 130% at 20% 0%, #17140A 0%, #0D0B09 62%)',
        }}
      >
        <div dir="ltr" style={{ display: 'flex', alignItems: 'baseline', gap: '1px' }}>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: '22px', fontWeight: 700, color: '#FFFFFF' }}>
            AFF
          </span>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: '22px', fontWeight: 700, color: 'var(--primary)' }}>
            EX
          </span>
        </div>
        <div
          dir="ltr"
          style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', letterSpacing: '0.2em', color: 'var(--muted-fainter)' }}
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
            color: '#FFFFFF',
            maxWidth: '18ch',
          }}
        >
          {statement}
        </h1>
        <div
          style={{
            borderTop: '1px solid var(--border)',
            paddingTop: '20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}
        >
          {trust.map(({ Icon, label }) => (
            <div
              key={label}
              style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13.5px', color: 'var(--muted-foreground)' }}
            >
              <Icon size={16} strokeWidth={2} color="#F5C518" />
              {label}
            </div>
          ))}
        </div>
      </div>

      {/* Right — light form panel */}
      <div
        className="affex-doc"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 'clamp(28px,4vw,52px) clamp(24px,4vw,48px)',
          background: '#F6F4EF',
        }}
      >
        <div style={{ width: '100%', maxWidth: '400px' }}>{form}</div>
      </div>
    </main>
  )
}
