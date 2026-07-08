import type { ReactNode } from 'react'

/**
 * A light bordered card for the white editorial body — white surface, thin
 * #DED8CB border, an optional mono uppercase title, dark content. Reused across
 * the deliverable displays (Deep Brief, Test Kit, Ad Copy, ...).
 */
export function EditorialCard({
  title,
  children,
}: {
  title?: string
  children: ReactNode
}) {
  return (
    <div style={{ background: '#FFFFFF', border: '1px solid #DED8CB', padding: '16px 18px' }}>
      {title && (
        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '10px',
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: '#8A8375',
            marginBottom: '8px',
          }}
        >
          {title}
        </div>
      )}
      <div style={{ fontSize: '14px', color: '#1F1B16', lineHeight: 1.5 }}>{children}</div>
    </div>
  )
}
