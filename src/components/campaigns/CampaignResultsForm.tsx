'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslations } from 'next-intl'
import { useState, useTransition } from 'react'
import { useForm } from 'react-hook-form'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { saveCampaignResults } from '@/lib/actions/campaigns'
import {
  CampaignResultsSchema,
  type CampaignResultsInput,
} from '@/lib/validations/campaign'

const FIELDS: Array<{ key: keyof CampaignResultsInput; labelKey: string }> = [
  { key: 'spend_usd', labelKey: 'fieldSpend' },
  { key: 'revenue_usd', labelKey: 'fieldRevenue' },
  { key: 'impressions', labelKey: 'fieldImpressions' },
  { key: 'clicks', labelKey: 'fieldClicks' },
  { key: 'landing_views', labelKey: 'fieldLandingViews' },
  { key: 'conversions', labelKey: 'fieldConversions' },
  { key: 'days_running', labelKey: 'fieldDaysRunning' },
]

export function CampaignResultsForm({
  campaignId,
  initial,
}: {
  campaignId: string
  initial?: Partial<Record<keyof CampaignResultsInput, number | string>>
}) {
  const t = useTranslations('campaigns')
  const [isPending, startTransition] = useTransition()
  const [serverError, setServerError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CampaignResultsInput>({
    resolver: zodResolver(CampaignResultsSchema),
    defaultValues: {
      spend_usd: Number(initial?.spend_usd ?? 0),
      revenue_usd: Number(initial?.revenue_usd ?? 0),
      impressions: Number(initial?.impressions ?? 0),
      clicks: Number(initial?.clicks ?? 0),
      landing_views: Number(initial?.landing_views ?? 0),
      conversions: Number(initial?.conversions ?? 0),
      days_running: Number(initial?.days_running ?? 0),
    },
  })

  function onSubmit(values: CampaignResultsInput) {
    setServerError(null)
    setSaved(false)
    startTransition(async () => {
      const result = await saveCampaignResults(campaignId, values)
      if (result && 'error' in result) setServerError(result.error)
      else setSaved(true)
    })
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {FIELDS.map((f) => (
          <div key={f.key} className="flex flex-col gap-1.5">
            <Label htmlFor={f.key}>{t(f.labelKey)}</Label>
            <Input
              id={f.key}
              type="number"
              step="any"
              {...register(f.key)}
            />
            {errors[f.key] && (
              <p className="text-sm text-red-600">{errors[f.key]?.message}</p>
            )}
          </div>
        ))}
      </div>
      {serverError && <p className="text-sm text-red-600">{serverError}</p>}
      {saved && <p className="text-sm text-green-700">{t('saved')}</p>}
      <div>
        <Button type="submit" disabled={isPending}>
          {isPending ? t('saving') : t('saveResults')}
        </Button>
      </div>
    </form>
  )
}
