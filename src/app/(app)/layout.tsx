import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { redirect } from 'next/navigation'

import { LanguageToggle } from '@/components/LanguageToggle'
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

  return (
    <div className="flex min-h-screen">
      <aside className="flex w-56 shrink-0 flex-col border-e border-[var(--color-border)] p-4">
        <div className="mb-6 text-lg font-semibold">AffiliateOS</div>
        <nav className="flex flex-col gap-1 text-sm">
          <Link
            href="/offers"
            className="rounded-md px-3 py-2 hover:bg-[var(--color-muted)]"
          >
            {t('offers')}
          </Link>
          <Link
            href="/campaigns"
            className="rounded-md px-3 py-2 hover:bg-[var(--color-muted)]"
          >
            {t('campaigns')}
          </Link>
          {isAdmin && (
            <Link
              href="/admin"
              className="rounded-md px-3 py-2 hover:bg-[var(--color-muted)]"
            >
              {t('admin')}
            </Link>
          )}
        </nav>
        <div className="mt-auto flex flex-col gap-2">
          <Link
            href="/billing"
            className="rounded-md border border-[var(--color-border)] px-3 py-2 text-sm hover:bg-[var(--color-muted)]"
          >
            <span className="text-[var(--color-muted-foreground)]">
              {t('credits')}
            </span>{' '}
            <span className="font-semibold">{balance ?? '—'}</span>
          </Link>
          <LanguageToggle />
        </div>
      </aside>
      <main className="flex-1 p-6">{children}</main>
    </div>
  )
}
