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

  // Gate the app until onboarding is done (/onboarding is outside this group).
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
          padding: '20px 0',
        }}
      >
        {/* Logo */}
        <div style={{ padding: '0 16px 24px', fontSize: '20px', fontWeight: 800, letterSpacing: '-0.02em' }}>
          <span style={{ color: 'var(--foreground)' }}>AFF</span>
          <span style={{ color: 'var(--primary)' }}>EX</span>
        </div>

        {/* Nav */}
        <AppNav items={navItems} />

        {/* Footer */}
        <div style={{ marginTop: 'auto', padding: '16px' }}>
          <div
            style={{
              fontSize: '11px',
              color: 'var(--muted-foreground)',
              padding: '6px 0',
            }}
          >
            <span>{t('credits')}</span>{' '}
            <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{balance ?? '—'}</span>
          </div>
          <LanguageToggle />
        </div>
      </aside>
      <main className="flex-1 p-6">{children}</main>
    </div>
  )
}
