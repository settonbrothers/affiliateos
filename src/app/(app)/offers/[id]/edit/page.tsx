import Link from 'next/link'
import { notFound } from 'next/navigation'

import { OfferForm } from '@/components/offers/OfferForm'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { getOfferById, listVerticals } from '@/lib/queries/offers'

export default async function EditOfferPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const offer = await getOfferById(id)
  if (!offer) notFound()

  const verticals = await listVerticals()

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      <Link
        href={`/offers/${id}`}
        className="text-sm text-[var(--color-muted-foreground)] underline"
      >
        ← {offer.name}
      </Link>
      <Card>
        <CardHeader>
          <CardTitle>Edit offer</CardTitle>
        </CardHeader>
        <CardContent>
          <OfferForm
            verticals={verticals}
            mode={{ kind: 'edit', offerId: id }}
            initial={{
              name: offer.name,
              vertical_id: offer.vertical_id,
              website_url: offer.website_url ?? '',
              affiliate_program_url: offer.affiliate_program_url ?? '',
              operator_notes: offer.operator_notes ?? '',
            }}
          />
        </CardContent>
      </Card>
    </div>
  )
}
