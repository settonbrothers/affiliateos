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

  return (
    <div className="mx-auto max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle>Add offer</CardTitle>
        </CardHeader>
        <CardContent>
          <OfferForm verticals={verticals} mode={{ kind: 'create' }} />
        </CardContent>
      </Card>
    </div>
  )
}
