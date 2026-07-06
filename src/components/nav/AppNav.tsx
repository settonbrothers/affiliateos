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
    <Link
      href={href}
      style={{
        display: 'block',
        padding: '9px 16px',
        fontSize: '13px',
        fontWeight: 500,
        borderRadius: '8px',
        textDecoration: 'none',
        transition: 'var(--transition)',
        color: active ? 'var(--foreground)' : 'var(--muted-foreground)',
        background: active ? '#1f1f1f' : 'transparent',
        borderLeft: active ? '3px solid var(--primary)' : '3px solid transparent',
      }}
    >
      {label}
    </Link>
  )
}

interface AppNavProps {
  items: NavItemProps[]
}

export function AppNav({ items }: AppNavProps) {
  return (
    <nav style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
      {items.map((item) => (
        <NavItem key={item.href} href={item.href} label={item.label} />
      ))}
    </nav>
  )
}
