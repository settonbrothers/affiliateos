import type { ReactNode } from 'react'

/**
 * A dark callout slab for the single headline insight inside the white body —
 * the contrast makes the key takeaway read as the verdict.
 */
export function EditorialSlab({
  label,
  children,
}: {
  label?: string
  children: ReactNode
}) {
  return (
    <div style={{ background: '#0D0B09', color: '#FFFFFF', padding: 'clamp(20px,3vw,32px)' }}>
      {label && (
        <div
          dir="ltr"
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '10px',
            letterSpacing: '0.14em',
            color: 'var(--muted-faint)',
            marginBottom: '10px',
          }}
        >
          {label}
        </div>
      )}
      {children}
    </div>
  )
}
