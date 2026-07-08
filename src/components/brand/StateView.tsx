import Link from 'next/link'
import type { ReactNode } from 'react'

/**
 * The AFFEX empty / error state pattern (per the States mock): a bordered icon
 * box, mono eyebrow, big title, body, an optional meta strip (credits / refund),
 * a primary CTA and an optional secondary link. `tone` switches accent (Giallo)
 * vs warn (muted red).
 */
export function StateView({
  icon,
  eyebrow,
  title,
  body,
  ctaLabel,
  ctaHref,
  secondaryLabel,
  secondaryHref,
  meta,
  tone = 'accent',
}: {
  icon: ReactNode
  eyebrow: string
  title: string
  body: string
  ctaLabel: string
  ctaHref: string
  secondaryLabel?: string
  secondaryHref?: string
  meta?: string
  tone?: 'accent' | 'warn'
}) {
  const warn = tone === 'warn'
  const accent = warn ? '#C97A6E' : '#F5C518'
  const iconBorder = warn ? 'rgba(201,122,110,0.4)' : 'rgba(245,197,24,0.4)'
  const iconBg = warn ? 'rgba(201,122,110,0.06)' : 'rgba(245,197,24,0.06)'

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'clamp(24px,5vw,64px) 0' }}>
      <div style={{ width: '100%', maxWidth: '560px', textAlign: 'center', animation: 'affexFadeUp 0.4s ease-out both' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '26px' }}>
          <div
            style={{
              width: '64px',
              height: '64px',
              border: `1px solid ${iconBorder}`,
              background: iconBg,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: accent,
            }}
          >
            {icon}
          </div>
        </div>

        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10.5px', letterSpacing: '0.2em', color: accent, marginBottom: '14px' }}>
          {eyebrow}
        </div>
        <h1 style={{ margin: '0 0 12px', fontFamily: 'var(--font-sans)', fontSize: 'clamp(28px,4vw,42px)', fontWeight: 800, lineHeight: 1.05 }}>
          {title}
        </h1>
        <p style={{ margin: '0 auto 28px', maxWidth: '42ch', fontSize: '14.5px', lineHeight: 1.7, color: '#8A8A88' }}>
          {body}
        </p>

        {meta && (
          <div
            dir="ltr"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '12px',
              border: `1px solid ${warn ? 'rgba(201,122,110,0.3)' : 'rgba(245,197,24,0.3)'}`,
              background: warn ? 'rgba(201,122,110,0.05)' : 'rgba(245,197,24,0.05)',
              padding: '10px 16px',
              marginBottom: '28px',
              fontFamily: 'var(--font-mono)',
              fontSize: '12px',
              color: accent,
            }}
          >
            {meta}
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '16px', flexWrap: 'wrap' }}>
          <Link
            href={ctaHref}
            className="affex-cta"
            style={{
              fontFamily: 'var(--font-sans)',
              fontSize: '15px',
              fontWeight: 700,
              color: '#0A0A0A',
              background: '#F5C518',
              border: 'none',
              padding: '14px 28px',
              textDecoration: 'none',
            }}
          >
            {ctaLabel}
          </Link>
          {secondaryLabel && secondaryHref && (
            <Link href={secondaryHref} style={{ fontSize: '13.5px', color: '#8A8A88', textDecoration: 'none' }}>
              {secondaryLabel}
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}
