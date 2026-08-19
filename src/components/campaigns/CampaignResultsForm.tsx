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

const NUMBER_FIELDS: Array<{
  key: keyof CampaignResultsInput
  labelKey: string
}> = [
  { key: 'spend_amount', labelKey: 'fieldSpend' },
  { key: 'commission_amount', labelKey: 'fieldCommission' },
  { key: 'impressions', labelKey: 'fieldImpressions' },
  { key: 'clicks', labelKey: 'fieldClicks' },
  { key: 'landing_views', labelKey: 'fieldLandingViews' },
  { key: 'affiliate_clicks', labelKey: 'fieldAffiliateClicks' },
  { key: 'conversions', labelKey: 'fieldConversions' },
  { key: 'approved_conversions', labelKey: 'fieldApprovedConversions' },
  { key: 'reversed_conversions', labelKey: 'fieldReversedConversions' },
  { key: 'days_running', labelKey: 'fieldDaysRunning' },
]

export function CampaignResultsForm({
  campaignId,
  initial,
}: {
  campaignId: string
  initial?: Partial<Record<keyof CampaignResultsInput, number | string | null>>
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
      spend_amount: Number(initial?.spend_amount ?? 0),
      spend_currency: String(initial?.spend_currency ?? 'USD'),
      commission_amount: Number(initial?.commission_amount ?? 0),
      commission_currency: String(
        initial?.commission_currency ?? initial?.spend_currency ?? 'USD'
      ),
      impressions: Number(initial?.impressions ?? 0),
      clicks: Number(initial?.clicks ?? 0),
      landing_views: Number(initial?.landing_views ?? 0),
      affiliate_clicks: Number(initial?.affiliate_clicks ?? 0),
      conversions: Number(initial?.conversions ?? 0),
      approved_conversions: Number(initial?.approved_conversions ?? 0),
      reversed_conversions: Number(initial?.reversed_conversions ?? 0),
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
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
          gap: '1px',
          background: '#DED8CB',
          border: '1px solid #DED8CB',
        }}
      >
        {NUMBER_FIELDS.map((f) => (
          <div
            key={f.key}
            style={{
              background: '#F6F4EF',
              padding: '16px 18px',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
            }}
          >
            <Label
              htmlFor={f.key}
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '9.5px',
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                color: '#6B6459',
              }}
            >
              {t(f.labelKey)}
            </Label>
            <Input
              id={f.key}
              type="number"
              step="any"
              className="bg-white border-[#D8D2C6] text-[#1F1B16] placeholder:text-[#9A8F73]"
              {...register(f.key)}
            />
            {errors[f.key] && (
              <p style={{ fontSize: '12px', color: '#B4232A' }}>
                {errors[f.key]?.message}
              </p>
            )}
          </div>
        ))}
        {(['spend_currency', 'commission_currency'] as const).map((key) => (
          <div
            key={key}
            style={{
              background: '#F6F4EF',
              padding: '16px 18px',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
            }}
          >
            <Label
              htmlFor={key}
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '9.5px',
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                color: '#6B6459',
              }}
            >
              {t(
                key === 'spend_currency'
                  ? 'fieldSpendCurrency'
                  : 'fieldCommissionCurrency'
              )}
            </Label>
            <Input
              id={key}
              maxLength={3}
              className="bg-white border-[#D8D2C6] uppercase"
              {...register(key)}
            />
            {errors[key] && (
              <p style={{ fontSize: '12px', color: '#B4232A' }}>
                {errors[key]?.message}
              </p>
            )}
          </div>
        ))}
      </div>
      {serverError && (
        <p style={{ fontSize: '13px', color: '#B4232A' }}>{serverError}</p>
      )}
      {saved && (
        <p style={{ fontSize: '13px', color: '#1F7A3D' }}>{t('saved')}</p>
      )}
      <div>
        <Button type="submit" disabled={isPending}>
          {isPending ? t('saving') : t('saveResults')}
        </Button>
      </div>
    </form>
  )
}
