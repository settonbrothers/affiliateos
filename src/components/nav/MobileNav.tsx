'use client'

import { X } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { LinkPending } from '@/components/nav/LinkPending'

interface MobileNavItem {
  href: string
  label: string
}

const EN_LABEL: Record<string, string> = {
  '/offers': 'AI PICKS',
  '/campaigns': 'CAMPAIGNS',
  '/billing': 'BILLING',
  '/admin': 'ADMIN',
}

export function MobileNav({
  items,
  balance,
}: {
  items: MobileNavItem[]
  balance: number | null
}) {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()

  return (
    <>
      <button
        type="button"
        aria-label="Open menu"
        onClick={() => setOpen(true)}
        className="affex-mobile-only"
        style={{ flexDirection: 'column', gap: '4px', background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
      >
        <span style={{ width: '20px', height: '2px', background: '#FFFFFF' }} />
        <span style={{ width: '20px', height: '2px', background: '#FFFFFF' }} />
        <span style={{ width: '13px', height: '2px', background: 'var(--primary)' }} />
      </button>

      {open && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 50,
            background:
              'radial-gradient(70% 50% at 80% 6%, rgba(245,197,24,0.08) 0%, rgba(10,10,10,0) 55%), #0A0A0A',
            display: 'flex',
            flexDirection: 'column',
            animation: 'affexFadeUp 0.25s ease-out both',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '56px', padding: '0 18px', borderBottom: '1px solid rgba(255,255,255,0.09)' }}>
            <button
              type="button"
              aria-label="Close menu"
              onClick={() => setOpen(false)}
              style={{ background: 'none', border: 'none', color: '#FFFFFF', cursor: 'pointer', display: 'flex', padding: 0 }}
            >
              <X size={22} strokeWidth={1.5} />
            </button>
            <div dir="ltr" style={{ display: 'flex', alignItems: 'baseline', gap: '1px' }}>
              <span style={{ fontFamily: 'var(--font-display)', fontSize: '19px', fontWeight: 700, color: '#FFFFFF' }}>AFF</span>
              <span style={{ fontFamily: 'var(--font-display)', fontSize: '19px', fontWeight: 700, color: 'var(--primary)' }}>EX</span>
            </div>
            <span style={{ width: '22px' }} />
          </div>

          <div style={{ flex: 1, padding: '40px 24px', display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', letterSpacing: '0.2em', color: '#6E6E6C', marginBottom: '24px' }}>
              MENU
            </div>
            {items.map((n) => {
              const active = pathname === n.href || pathname.startsWith(n.href + '/')
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  onClick={() => setOpen(false)}
                  style={{
                    padding: '18px 0',
                    borderBottom: `1px solid ${active ? 'rgba(245,197,24,0.4)' : 'rgba(255,255,255,0.08)'}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    textDecoration: 'none',
                  }}
                >
                  <span dir="ltr" style={{ fontFamily: 'var(--font-display)', fontSize: '30px', fontWeight: 600, color: active ? 'var(--primary)' : '#FFFFFF' }}>
                    {EN_LABEL[n.href] ?? n.label.toUpperCase()}
                  </span>
                  <span style={{ fontFamily: 'var(--font-sans)', fontSize: '13px', color: active ? 'var(--primary)' : '#6E6E6C' }}>
                    {n.label}
                  </span>
                  <LinkPending />
                </Link>
              )
            })}

            <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', paddingTop: '20px', borderTop: '1px solid rgba(255,255,255,0.09)' }}>
              <div dir="ltr" style={{ display: 'flex', alignItems: 'center', gap: '7px', fontFamily: 'var(--font-mono)' }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--primary)' }} />
                <span style={{ fontSize: '13px', fontWeight: 600, color: '#E4E4E2' }}>{balance ?? '—'}</span>
                <span style={{ fontSize: '10px', color: '#7A7A78' }}>CREDITS</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
