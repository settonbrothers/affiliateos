import Link from 'next/link'
import type { CSSProperties, ReactNode } from 'react'

type Col = { label: string; ltr?: boolean }

/** Mono header row for the admin data grids (matches AiRunsTable / the mock). */
export function AdminTable({
  cols,
  columns,
  children,
}: {
  cols: string
  columns: Col[]
  children: ReactNode
}) {
  return (
    <div>
      <div
        dir="rtl"
        style={{
          display: 'grid',
          gridTemplateColumns: cols,
          gap: '16px',
          padding: '12px',
          fontFamily: 'var(--font-mono)',
          fontSize: '9.5px',
          letterSpacing: '0.1em',
          color: '#5E5E5C',
          borderBottom: '1px solid rgba(255,255,255,0.09)',
        }}
      >
        {columns.map((c, i) => (
          <span key={i} dir={c.ltr ? 'ltr' : undefined} style={c.ltr ? { textAlign: 'right' } : undefined}>
            {c.label}
          </span>
        ))}
      </div>
      {children}
    </div>
  )
}

/** One data row; a link when `href` is given, otherwise a plain row. */
export function AdminRow({
  cols,
  href,
  children,
}: {
  cols: string
  href?: string
  children: ReactNode
}) {
  const style: CSSProperties = {
    display: 'grid',
    gridTemplateColumns: cols,
    gap: '16px',
    padding: '14px 12px',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
    alignItems: 'center',
    textDecoration: 'none',
    color: 'inherit',
  }
  return href ? (
    <Link href={href} className="affex-trow" dir="rtl" style={style}>
      {children}
    </Link>
  ) : (
    <div className="affex-trow" dir="rtl" style={style}>
      {children}
    </div>
  )
}
