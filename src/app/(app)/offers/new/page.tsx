import { CreateOfferForm } from '@/components/offers/CreateOfferForm'
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
    <div className="mx-auto max-w-lg">
      <Card>
        <CardHeader>
          <CardTitle>Add offer</CardTitle>
        </CardHeader>
        <CardContent>
          <CreateOfferForm verticals={verticals} />
        </CardContent>
      </Card>
    </div>
  )
}
