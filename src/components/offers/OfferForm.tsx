'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { useState, useTransition } from 'react'
import { useForm } from 'react-hook-form'

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

const errText = { fontSize: '13px', color: '#F06A6A' } as const

export function OfferForm({ verticals, mode, initial }: Props) {
  const t = useTranslations('offers')
  const [isPending, startTransition] = useTransition()
  const [serverError, setServerError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    setValue,
    watch,
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

  const verticalId = watch('vertical_id')

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

  const submitLabel = mode.kind === 'create' ? t('createOffer') : t('saveChanges')
  const pendingLabel = mode.kind === 'create' ? t('creating') : t('saving')
  const cancelHref = mode.kind === 'create' ? '/offers' : `/offers/${mode.offerId}`

  return (
    <form onSubmit={handleSubmit(onSubmit)} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div>
        <label htmlFor="name" className="affex-fld-label">{t('name')} *</label>
        <input id="name" className="affex-fld" placeholder="Reely — AI Video Repurposer" {...register('name')} />
        {errors.name && <p style={errText}>{errors.name.message}</p>}
      </div>

      <div className="grid gap-[18px] sm:grid-cols-2">
        <div>
          <label htmlFor="website_url" className="affex-fld-label">{t('websiteUrl')} *</label>
          <input id="website_url" type="url" dir="ltr" className="affex-fld" style={{ textAlign: 'right' }} placeholder="reely.io" {...register('website_url')} />
          {errors.website_url && <p style={errText}>{errors.website_url.message}</p>}
        </div>
        <div>
          <label htmlFor="affiliate_program_url" className="affex-fld-label">{t('affiliateProgramUrl')}</label>
          <input id="affiliate_program_url" type="url" dir="ltr" className="affex-fld" style={{ textAlign: 'right' }} placeholder="reely.io/partners" {...register('affiliate_program_url')} />
          {errors.affiliate_program_url && <p style={errText}>{errors.affiliate_program_url.message}</p>}
        </div>
      </div>

      <div>
        <label className="affex-fld-label">{t('vertical')}</label>
        <input type="hidden" {...register('vertical_id')} />
        <div style={{ display: 'flex', gap: '9px', flexWrap: 'wrap' }}>
          {verticals.map((v) => {
            const on = verticalId === v.id
            return (
              <button
                type="button"
                key={v.id}
                onClick={() => setValue('vertical_id', v.id, { shouldValidate: true })}
                style={{
                  border: `1px solid ${on ? 'var(--primary)' : 'rgba(255,255,255,0.16)'}`,
                  background: on ? 'var(--primary)' : 'transparent',
                  color: on ? '#0A0A0A' : '#B0B0AE',
                  padding: '9px 16px',
                  fontSize: '13.5px',
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                {v.name}
              </button>
            )
          })}
        </div>
        {errors.vertical_id && <p style={errText}>{errors.vertical_id.message}</p>}
      </div>

      <div>
        <label htmlFor="operator_notes" className="affex-fld-label">{t('operatorNotes')}</label>
        <textarea
          id="operator_notes"
          rows={5}
          className="affex-fld"
          style={{ resize: 'vertical', lineHeight: 1.6 }}
          placeholder={NOTES_PLACEHOLDER}
          {...register('operator_notes')}
        />
        <p style={{ margin: '9px 0 0', fontSize: '12px', color: '#6E6E6C', lineHeight: 1.5 }}>
          {t('operatorNotesHint')}
        </p>
        {errors.operator_notes && <p style={errText}>{errors.operator_notes.message}</p>}
      </div>

      {serverError && <p style={errText}>{serverError}</p>}

      <div
        style={{
          marginTop: '12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px',
          borderTop: '1px solid rgba(255,255,255,0.09)',
          paddingTop: '24px',
        }}
      >
        <Link href={cancelHref} style={{ fontSize: '14px', color: '#7A7A78', textDecoration: 'none' }}>
          {t('cancel')}
        </Link>
        <button
          type="submit"
          disabled={isPending}
          className="affex-cta"
          style={{
            fontFamily: 'var(--font-sans)',
            fontSize: '15px',
            fontWeight: 700,
            color: '#0A0A0A',
            background: 'var(--primary)',
            border: 'none',
            padding: '14px 30px',
            cursor: isPending ? 'default' : 'pointer',
            opacity: isPending ? 0.6 : 1,
          }}
        >
          {isPending ? pendingLabel : `${submitLabel} ‹`}
        </button>
      </div>
    </form>
  )
}
