import { getTranslations } from 'next-intl/server'
import Link from 'next/link'

import { OffersTable } from '@/components/offers/OffersTable'
import { Button } from '@/components/ui/button'
import { listOffers } from '@/lib/queries/offers'

export default async function OffersPage() {
  const offers = await listOffers()
  const t = await getTranslations('offers')

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{t('title')}</h1>
        <Button asChild>
          <Link href="/offers/new">{t('addOffer')}</Link>
        </Button>
      </div>
      <OffersTable offers={offers} />
    </div>
  )
}
