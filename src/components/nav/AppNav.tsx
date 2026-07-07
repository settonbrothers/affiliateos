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
      className="navlink"
      style={{
        position: 'relative',
        display: 'inline-block',
        padding: '0 0 20px',
        fontSize: '13.5px',
        fontWeight: 500,
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
            bottom: 'calc(-1 * ((var(--nav-height) - 20px) / 2) + 10px)',
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
