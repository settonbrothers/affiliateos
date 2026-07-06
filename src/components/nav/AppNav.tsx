'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

interface NavItemProps {
  href: string
  label: string
}

function NavItem({ href, label }: NavItemProps) {
  const pathname = usePathname()
  const active = pathname === href || pathname.startsWith(href + '/')

  return (
    <div style={{ position: 'relative' }}>
      {/* Active indicator — separate from the rounded link so border-radius doesn't clip it */}
      {active && (
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: '7px',
            bottom: '7px',
            width: '3px',
            background: 'var(--primary)',
            borderRadius: '0 2px 2px 0',
          }}
        />
      )}
      <Link
        href={href}
        className={active ? '' : 'hover:bg-[rgba(255,255,255,0.04)]'}
        style={{
          display: 'block',
          padding: '9px 16px 9px 20px',
          fontSize: '13px',
          fontWeight: active ? 500 : 400,
          textDecoration: 'none',
          transition: 'var(--transition)',
          color: active ? 'var(--foreground)' : 'var(--muted-foreground)',
          background: active ? 'rgba(255,255,255,0.04)' : 'transparent',
          borderRadius: '0 8px 8px 0',
        }}
      >
        {label}
      </Link>
    </div>
  )
}

interface AppNavProps {
  items: NavItemProps[]
}

export function AppNav({ items }: AppNavProps) {
  return (
    <nav style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
      {items.map((item) => (
        <NavItem key={item.href} href={item.href} label={item.label} />
      ))}
    </nav>
  )
}
