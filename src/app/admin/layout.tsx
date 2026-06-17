import { getTranslations } from 'next-intl/server'
import Link from 'next/link'
import { redirect } from 'next/navigation'

import { LanguageToggle } from '@/components/LanguageToggle'
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
    <div className="flex min-h-screen">
      <aside className="flex w-56 shrink-0 flex-col border-e border-[var(--color-border)] p-4">
        <div className="mb-6 text-lg font-semibold">{t('adminTitle')}</div>
        <nav className="flex flex-col gap-1 text-sm">
          {links.map(([href, label]) => (
            <Link
              key={href}
              href={href}
              className="rounded-md px-3 py-2 hover:bg-[var(--color-muted)]"
            >
              {label}
            </Link>
          ))}
          <Link
            href="/offers"
            className="rounded-md px-3 py-2 text-[var(--color-muted-foreground)] hover:bg-[var(--color-muted)]"
          >
            {t('backToApp')}
          </Link>
        </nav>
        <div className="mt-auto">
          <LanguageToggle />
        </div>
      </aside>
      <main className="flex-1 p-6">{children}</main>
    </div>
  )
}
