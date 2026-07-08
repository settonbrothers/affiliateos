import { Flag } from 'lucide-react'
import { getTranslations } from 'next-intl/server'
import Link from 'next/link'

import { StateView } from '@/components/brand/StateView'
import { Badge } from '@/components/ui/badge'
import { listCampaigns } from '@/lib/queries/campaigns'

export default async function CampaignsPage() {
  const campaigns = await listCampaigns()
  const t = await getTranslations('campaigns')

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">{t('title')}</h1>
        <p className="text-sm text-[var(--color-muted-foreground)]">
          {t('subtitle')}
        </p>
      </div>

      {campaigns.length === 0 ? (
        <StateView
          icon={<Flag size={24} strokeWidth={2} />}
          eyebrow="CAMPAIGNS · EMPTY"
          title={t('emptyTitle')}
          body={t('emptyBody')}
          ctaLabel={`${t('backToOffers')} ›`}
          ctaHref="/offers"
        />
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--color-border)] text-start">
              <th className="py-2 font-medium">{t('colCampaign')}</th>
              <th className="py-2 font-medium">{t('colOffer')}</th>
              <th className="py-2 font-medium">{t('colChannel')}</th>
              <th className="py-2 font-medium">{t('colStatus')}</th>
            </tr>
          </thead>
          <tbody>
            {campaigns.map((c) => (
              <tr key={c.id} className="border-b border-[var(--color-border)]">
                <td className="py-2">
                  <Link href={`/campaigns/${c.id}`} className="underline">
                    {c.name}
                  </Link>
                </td>
                <td className="py-2 text-[var(--color-muted-foreground)]">
                  {c.offers?.name ?? '—'}
                </td>
                <td className="py-2 text-[var(--color-muted-foreground)]">
                  {c.channel ?? '—'}
                </td>
                <td className="py-2">
                  <Badge>{c.status}</Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
