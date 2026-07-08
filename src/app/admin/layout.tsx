import { getTranslations } from 'next-intl/server'
import Link from 'next/link'
import { redirect } from 'next/navigation'

import { AdminNav } from '@/components/admin/AdminNav'
import { createClient } from '@/lib/supabase/server'

// /admin/* is auth-gated by middleware; this layout adds the admin-role check.
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('system_role')
    .eq('id', user.id)
    .maybeSingle()

  if (profile?.system_role !== 'admin') redirect('/offers')

  const t = await getTranslations('nav')
  const links: Array<[string, string]> = [
    ['/admin/ai-runs', t('aiRuns')],
    ['/admin/prompts', t('prompts')],
    ['/admin/eval', t('eval')],
    ['/admin/discovery', t('discovery')],
    ['/admin/kill-switches', t('killSwitches')],
    ['/admin/compliance', t('compliance')],
    ['/admin/invite-codes', t('inviteCodes')],
    ['/admin/failed', t('failed')],
  ]

  return (
    <div style={{ minHeight: '100vh', background: 'var(--background)', color: 'var(--foreground)', display: 'flex', flexDirection: 'column' }}>
      {/* Admin top bar */}
      <div
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 20,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          height: '62px',
          padding: '0 clamp(20px,3vw,44px)',
          background: 'rgba(42,36,29,0.96)',
          backdropFilter: 'blur(10px)',
          borderBottom: '1px solid rgba(255,255,255,0.09)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <Link href="/offers" dir="ltr" style={{ display: 'flex', alignItems: 'baseline', gap: '1px', textDecoration: 'none', color: 'inherit' }}>
            <span style={{ fontFamily: 'var(--font-display)', fontSize: '21px', fontWeight: 700 }}>AFF</span>
            <span style={{ fontFamily: 'var(--font-display)', fontSize: '21px', fontWeight: 700, color: 'var(--primary)' }}>EX</span>
          </Link>
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '11px',
              letterSpacing: '0.18em',
              color: '#B0B0AE',
              borderInlineStart: '1px solid rgba(255,255,255,0.14)',
              paddingInlineStart: '14px',
            }}
          >
            {t('adminTitle')}
          </span>
        </div>
        <Link href="/offers" style={{ fontFamily: 'var(--font-sans)', fontSize: '13px', color: '#B0B0AE', textDecoration: 'none' }}>
          ← {t('backToApp')}
        </Link>
      </div>

      {/* Sub tabs */}
      <AdminNav items={links.map(([href, label]) => ({ href, label }))} />

      <main style={{ flex: 1, padding: 'clamp(24px,3vw,40px) clamp(20px,4vw,64px) 56px', maxWidth: '1280px', width: '100%', margin: '0 auto' }}>
        {children}
      </main>
    </div>
  )
}
