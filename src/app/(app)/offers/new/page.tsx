import { getTranslations } from 'next-intl/server'

import { OfferForm } from '@/components/offers/OfferForm'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { listVerticals } from '@/lib/queries/offers'

export default async function NewOfferPage() {
  const verticals = await listVerticals()
  const t = await getTranslations('offers')

  return (
    <div className="mx-auto max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle>{t('newTitle')}</CardTitle>
        </CardHeader>
        <CardContent>
          <OfferForm verticals={verticals} mode={{ kind: 'create' }} />
        </CardContent>
      </Card>
    </div>
  )
}
