'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LinkPending } from '@/components/nav/LinkPending'

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
      className="navlink"
      style={{
        position: 'relative',
        height: 'var(--nav-height)',
        display: 'inline-flex',
        alignItems: 'center',
        padding: '0',
        fontSize: '13.5px',
        fontWeight: 500,
        textDecoration: 'none',
        color: active ? 'var(--foreground)' : '#B0B0AE',
        transition: 'color 0.2s',
      }}
    >
      {label}
      <LinkPending />
      {active && (
        <span
          style={{
            position: 'absolute',
            insetInline: 0,
            bottom: 0,
            height: '2px',
            background: 'var(--primary)',
          }}
        />
      )}
    </Link>
  )
}

interface AppNavProps {
  items: NavItemProps[]
}

export function AppNav({ items }: AppNavProps) {
  return (
    <nav style={{ display: 'flex', alignItems: 'center', gap: 'clamp(16px,2vw,30px)' }}>
      {items.map((item) => (
        <NavItem key={item.href} href={item.href} label={item.label} />
      ))}
    </nav>
  )
}
