import Link from 'next/link'
import { redirect } from 'next/navigation'

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

  return (
    <div className="flex min-h-screen">
      <aside className="w-56 shrink-0 border-r border-[var(--color-border)] p-4">
        <div className="mb-6 text-lg font-semibold">AffiliateOS · Admin</div>
        <nav className="flex flex-col gap-1 text-sm">
          <Link
            href="/admin/ai-runs"
            className="rounded-md px-3 py-2 hover:bg-[var(--color-muted)]"
          >
            AI Runs
          </Link>
          <Link
            href="/admin/prompts"
            className="rounded-md px-3 py-2 hover:bg-[var(--color-muted)]"
          >
            Prompts
          </Link>
          <Link
            href="/admin/eval"
            className="rounded-md px-3 py-2 hover:bg-[var(--color-muted)]"
          >
            Eval
          </Link>
          <Link
            href="/admin/kill-switches"
            className="rounded-md px-3 py-2 hover:bg-[var(--color-muted)]"
          >
            Kill Switches
          </Link>
          <Link
            href="/admin/compliance"
            className="rounded-md px-3 py-2 hover:bg-[var(--color-muted)]"
          >
            Compliance
          </Link>
          <Link
            href="/admin/invite-codes"
            className="rounded-md px-3 py-2 hover:bg-[var(--color-muted)]"
          >
            Invite Codes
          </Link>
          <Link
            href="/admin/failed"
            className="rounded-md px-3 py-2 hover:bg-[var(--color-muted)]"
          >
            Failed (DLQ)
          </Link>
          <Link
            href="/offers"
            className="rounded-md px-3 py-2 text-[var(--color-muted-foreground)] hover:bg-[var(--color-muted)]"
          >
            ← Back to app
          </Link>
        </nav>
      </aside>
      <main className="flex-1 p-6">{children}</main>
    </div>
  )
}
