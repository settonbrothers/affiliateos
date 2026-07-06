import { getTranslations } from 'next-intl/server'
import { redirect } from 'next/navigation'

import { LanguageToggle } from '@/components/LanguageToggle'
import { AppNav } from '@/components/nav/AppNav'
import { isCurrentUserAdmin } from '@/lib/auth/role'
import { getCurrentBalance } from '@/lib/queries/credits'
import { isOnboarded } from '@/lib/queries/onboarding'
import { createClient } from '@/lib/supabase/server'

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  if (!(await isOnboarded())) redirect('/onboarding')

  const balance = await getCurrentBalance()
  const isAdmin = await isCurrentUserAdmin()
  const t = await getTranslations('nav')

  const navItems = [
    { href: '/offers', label: t('offers') },
    { href: '/campaigns', label: t('campaigns') },
    { href: '/billing', label: 'Billing' },
    ...(isAdmin ? [{ href: '/admin', label: t('admin') }] : []),
  ]

  return (
    <div className="flex min-h-screen">
      <aside
        style={{
          width: 'var(--sidebar-width)',
          minWidth: 'var(--sidebar-width)',
          background: 'var(--sidebar-bg)',
          borderRight: '1px solid var(--border)',
          display: 'flex',
          flexDirection: 'column',
          paddingTop: '24px',
          paddingBottom: '16px',
        }}
      >
        {/* Logo */}
        <div style={{ padding: '0 20px 28px', fontSize: '18px', fontWeight: 800, letterSpacing: '-0.02em' }}>
          <span style={{ color: 'var(--foreground)' }}>AFF</span>
          <span style={{ color: 'var(--primary)' }}>EX</span>
        </div>

        {/* Nav */}
        <AppNav items={navItems} />

        {/* Footer */}
        <div
          style={{
            marginTop: 'auto',
            padding: '16px 20px 0',
            borderTop: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '8px',
          }}
        >
          {/* Credits pill */}
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              fontSize: '11px',
              color: 'var(--muted-foreground)',
            }}
          >
            <span
              style={{
                display: 'inline-block',
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                background: 'var(--primary)',
                opacity: 0.7,
              }}
            />
            <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>{balance ?? '—'}</span>
            <span>credits</span>
          </div>

          {/* Language toggle — minimal */}
          <LanguageToggle />
        </div>
      </aside>
      <main className="flex-1 overflow-auto p-8">{children}</main>
    </div>
  )
}
