import Link from 'next/link'

import { GoldenOfferForm } from '@/components/admin/GoldenOfferForm'
import { listVerticals } from '@/lib/queries/offers'

export default async function NewGoldenOfferPage() {
  const verticals = await listVerticals()

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <div>
        <Link
          href="/admin/eval/golden"
          className="text-sm text-[var(--color-muted-foreground)] underline"
        >
          ← Golden set
        </Link>
        <h1 className="text-2xl font-semibold">Add golden offer</h1>
        <p className="text-sm text-[var(--color-muted-foreground)]">
          Your verdict here is the ground truth the eval scores against. Be the
          honest skeptic — this is what keeps the prompt accurate.
        </p>
      </div>

      <GoldenOfferForm verticals={verticals} />
    </div>
  )
}
