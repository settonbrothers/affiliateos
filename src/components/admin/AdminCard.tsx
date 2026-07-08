import type { ReactNode } from 'react'

/** A dark bordered panel for admin card-style content (per the mock: #0C0C0C). */
export function AdminCard({
  title,
  right,
  children,
}: {
  title?: ReactNode
  right?: ReactNode
  children: ReactNode
}) {
  return (
    <div style={{ border: '1px solid rgba(255,255,255,0.1)', background: '#0C0C0C', padding: '18px 22px' }}>
      {(title || right) && (
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', marginBottom: '10px' }}>
          {title && (
            <div dir="ltr" style={{ fontFamily: 'var(--font-display)', fontSize: '17px', fontWeight: 500, textAlign: 'right', color: '#FFFFFF' }}>
              {title}
            </div>
          )}
          {right && <div style={{ flexShrink: 0 }}>{right}</div>}
        </div>
      )}
      {children}
    </div>
  )
}
