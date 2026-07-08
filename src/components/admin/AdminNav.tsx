'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

interface AdminNavItem {
  href: string
  label: string
}

function AdminTab({ href, label }: AdminNavItem) {
  const pathname = usePathname()
  const active = pathname === href || pathname.startsWith(href + '/')

  return (
    <Link
      href={href}
      className="navlink"
      style={{
        position: 'relative',
        padding: '16px 0',
        whiteSpace: 'nowrap',
        fontFamily: 'var(--font-sans)',
        fontSize: '14px',
        fontWeight: 600,
        textDecoration: 'none',
        color: active ? 'var(--foreground)' : '#7A7A78',
        transition: 'color 0.2s',
      }}
    >
      {label}
      {active && (
        <span
          style={{
            position: 'absolute',
            insetInline: 0,
            bottom: '-1px',
            height: '2px',
            background: 'var(--primary)',
          }}
        />
      )}
    </Link>
  )
}

export function AdminNav({ items }: { items: AdminNavItem[] }) {
  return (
    <nav
      style={{
        display: 'flex',
        gap: 'clamp(16px,2vw,32px)',
        padding: '0 clamp(20px,4vw,64px)',
        borderBottom: '1px solid rgba(255,255,255,0.09)',
        overflowX: 'auto',
      }}
    >
      {items.map((item) => (
        <AdminTab key={item.href} href={item.href} label={item.label} />
      ))}
    </nav>
  )
}
