import type { ReactNode } from 'react'

/**
 * One section on the white editorial body: a yellow bar + uppercase Oswald
 * heading (with an optional right-aligned note), a top thin rule, then content.
 */
export function EditorialSection({
  label,
  note,
  children,
}: {
  label: string
  note?: string
  children: ReactNode
}) {
  return (
    <section
      className="flex flex-col gap-5"
      style={{ paddingTop: 'clamp(28px,4vw,40px)', borderTop: '1px solid #DED8CB' }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '14px' }}>
        <span
          style={{ width: '4px', height: '24px', background: 'var(--primary)', flexShrink: 0 }}
        />
        <span
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(22px,3vw,34px)',
            fontWeight: 600,
            letterSpacing: '0.02em',
            color: '#1F1B16',
            textTransform: 'uppercase',
          }}
        >
          {label}
        </span>
        {note && (
          <span
            style={{
              fontFamily: 'var(--font-sans)',
              fontSize: '12px',
              color: '#8A8375',
              marginInlineStart: 'auto',
            }}
          >
            {note}
          </span>
        )}
      </div>
      {children}
    </section>
  )
}
