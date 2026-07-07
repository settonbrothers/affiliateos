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
    <div className="flex min-h-screen flex-col">
      <header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 20,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          height: 'var(--nav-height)',
          padding: '0 clamp(20px,3vw,44px)',
          background: 'rgba(14,12,10,0.92)',
          backdropFilter: 'blur(10px)',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 'clamp(20px,3vw,44px)' }}>
          <div dir="ltr" style={{ display: 'flex', alignItems: 'baseline', gap: '1px' }}>
            <span style={{ fontFamily: 'var(--font-display)', fontSize: '21px', fontWeight: 700 }}>AFF</span>
            <span style={{ fontFamily: 'var(--font-display)', fontSize: '21px', fontWeight: 700, color: 'var(--primary)' }}>EX</span>
          </div>
          <AppNav items={navItems} />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 'clamp(14px,2vw,22px)' }}>
          <div dir="ltr" style={{ display: 'flex', alignItems: 'center', gap: '7px', fontFamily: 'var(--font-mono)' }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--primary)' }} />
            <span style={{ fontSize: '12.5px', fontWeight: 600, color: '#E4E4E2' }}>{balance ?? '—'}</span>
            <span style={{ fontSize: '10px', letterSpacing: '0.08em', color: '#B0B0AE' }}>CR</span>
          </div>
          <LanguageToggle />
        </div>
      </header>
      <main className="flex-1 overflow-auto" style={{ padding: 'clamp(28px,4vw,52px) clamp(20px,4vw,64px) 40px' }}>
        <div style={{ maxWidth: '1500px', margin: '0 auto', width: '100%' }}>{children}</div>
      </main>
    </div>
  )
}
