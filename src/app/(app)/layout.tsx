import Link from 'next/link'
import { redirect } from 'next/navigation'

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

  return (
    <div className="flex min-h-screen">
      <aside className="w-56 shrink-0 border-r border-[var(--color-border)] p-4">
        <div className="mb-6 text-lg font-semibold">AffiliateOS</div>
        <nav className="flex flex-col gap-1 text-sm">
          <Link
            href="/offers"
            className="rounded-md px-3 py-2 hover:bg-[var(--color-muted)]"
          >
            Offers
          </Link>
          <Link
            href="/campaigns"
            className="rounded-md px-3 py-2 hover:bg-[var(--color-muted)]"
          >
            Campaigns
          </Link>
        </nav>
      </aside>
      <main className="flex-1 p-6">{children}</main>
    </div>
  )
}
