'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslations } from 'next-intl'
import { useState, useTransition } from 'react'
import { useForm } from 'react-hook-form'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { createOffer, updateOffer } from '@/lib/actions/offers'
import {
  OfferCreateSchema,
  type OfferCreateInput,
} from '@/lib/validations/offer'
import type { Vertical } from '@/types/db'

type Mode = { kind: 'create' } | { kind: 'edit'; offerId: string }

type Props = {
  verticals: Vertical[]
  mode: Mode
  initial?: Partial<OfferCreateInput>
}

const NOTES_PLACEHOLDER = `Anything you know that an extractor wouldn't pick up from a URL:
- internal CPA / payout you've confirmed privately
- target audience (geo, age, language, intent)
- traffic-rule details you got in DMs or affiliate manager calls
- vendor history (payment reliability, chargebacks, churn)
- compliance context (non-profit, regulated, etc.)`

export function OfferForm({ verticals, mode, initial }: Props) {
  const t = useTranslations('offers')
  const [isPending, startTransition] = useTransition()
  const [serverError, setServerError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<OfferCreateInput>({
    resolver: zodResolver(OfferCreateSchema),
    defaultValues: {
      name: initial?.name ?? '',
      vertical_id: initial?.vertical_id ?? '',
      website_url: initial?.website_url ?? '',
      affiliate_program_url: initial?.affiliate_program_url ?? '',
      operator_notes: initial?.operator_notes ?? '',
    },
  })

  function onSubmit(values: OfferCreateInput) {
    setServerError(null)
    startTransition(async () => {
      const result =
        mode.kind === 'create'
          ? await createOffer(values)
          : await updateOffer(mode.offerId, values)
      if (result && 'error' in result) setServerError(result.error)
    })
  }

  const submitLabel =
    mode.kind === 'create' ? t('createOffer') : t('saveChanges')
  const pendingLabel = mode.kind === 'create' ? t('creating') : t('saving')

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="name">{t('name')}</Label>
        <Input id="name" {...register('name')} />
        {errors.name && (
          <p className="text-sm text-red-600">{errors.name.message}</p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="vertical_id">{t('vertical')}</Label>
        <select
          id="vertical_id"
          className="flex h-10 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-background)] px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]"
          {...register('vertical_id')}
        >
          <option value="">{t('selectVertical')}</option>
          {verticals.map((vertical) => (
            <option key={vertical.id} value={vertical.id}>
              {vertical.name}
            </option>
          ))}
        </select>
        {errors.vertical_id && (
          <p className="text-sm text-red-600">{errors.vertical_id.message}</p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="website_url">{t('websiteUrl')}</Label>
        <Input id="website_url" type="url" {...register('website_url')} />
        {errors.website_url && (
          <p className="text-sm text-red-600">{errors.website_url.message}</p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="affiliate_program_url">
          {t('affiliateProgramUrl')}
        </Label>
        <Input
          id="affiliate_program_url"
          type="url"
          {...register('affiliate_program_url')}
        />
        {errors.affiliate_program_url && (
          <p className="text-sm text-red-600">
            {errors.affiliate_program_url.message}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="operator_notes">{t('operatorNotes')}</Label>
        <p className="text-xs text-[var(--color-muted-foreground)]">
          {t('operatorNotesHint')}
        </p>
        <Textarea
          id="operator_notes"
          rows={8}
          placeholder={NOTES_PLACEHOLDER}
          {...register('operator_notes')}
        />
        {errors.operator_notes && (
          <p className="text-sm text-red-600">{errors.operator_notes.message}</p>
        )}
      </div>

      {serverError && <p className="text-sm text-red-600">{serverError}</p>}

      <Button type="submit" disabled={isPending}>
        {isPending ? pendingLabel : submitLabel}
      </Button>
    </form>
  )
}
