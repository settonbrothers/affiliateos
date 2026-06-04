'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useState, useTransition } from 'react'
import { useForm } from 'react-hook-form'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { createGoldenOffer } from '@/lib/actions/golden'
import {
  GoldenOfferSchema,
  type GoldenOfferInput,
} from '@/lib/validations/golden'
import { VERDICTS } from '@/types/agents/underwriting'
import type { Vertical } from '@/types/db'

const SELECT_CLASS =
  'flex h-10 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-background)] px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]'

const FACTS_PLACEHOLDER = `[
  { "fact_type": "commission_value", "fact_value": "30% recurring", "source_quote": "30% lifetime recurring commission", "confidence_score": 90 }
]`

export function GoldenOfferForm({ verticals }: { verticals: Vertical[] }) {
  const [isPending, startTransition] = useTransition()
  const [serverError, setServerError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<GoldenOfferInput>({
    resolver: zodResolver(GoldenOfferSchema),
    defaultValues: {
      external_id: '',
      offer_name: '',
      vertical_id: '',
      offer_url: '',
      facts_snapshot: '',
      notes: '',
    },
  })

  function onSubmit(values: GoldenOfferInput) {
    setServerError(null)
    startTransition(async () => {
      const result = await createGoldenOffer(values)
      if (result && 'error' in result) setServerError(result.error)
    })
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="offer_name">Offer name</Label>
        <Input id="offer_name" {...register('offer_name')} />
        {errors.offer_name && (
          <p className="text-sm text-red-600">{errors.offer_name.message}</p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="external_id">External id (e.g. gold-001)</Label>
        <Input id="external_id" {...register('external_id')} />
        {errors.external_id && (
          <p className="text-sm text-red-600">{errors.external_id.message}</p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="vertical_id">Vertical</Label>
        <select id="vertical_id" className={SELECT_CLASS} {...register('vertical_id')}>
          <option value="">Select a vertical…</option>
          {verticals.map((v) => (
            <option key={v.id} value={v.id}>
              {v.name}
            </option>
          ))}
        </select>
        {errors.vertical_id && (
          <p className="text-sm text-red-600">{errors.vertical_id.message}</p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="expected_verdict">Expected verdict (your label)</Label>
        <select
          id="expected_verdict"
          className={SELECT_CLASS}
          defaultValue=""
          {...register('expected_verdict')}
        >
          <option value="">Select the correct verdict…</option>
          {VERDICTS.map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>
        {errors.expected_verdict && (
          <p className="text-sm text-red-600">
            {errors.expected_verdict.message}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="offer_url">Offer URL (optional)</Label>
        <Input id="offer_url" type="url" {...register('offer_url')} />
        {errors.offer_url && (
          <p className="text-sm text-red-600">{errors.offer_url.message}</p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="facts_snapshot">Facts snapshot (JSON array)</Label>
        <p className="text-xs text-[var(--color-muted-foreground)]">
          The exact facts fed to the orchestrator during eval. Same shape as
          extracted_facts. Leave empty for <code>[]</code>.
        </p>
        <Textarea
          id="facts_snapshot"
          rows={8}
          placeholder={FACTS_PLACEHOLDER}
          className="font-mono text-xs"
          {...register('facts_snapshot')}
        />
        {errors.facts_snapshot && (
          <p className="text-sm text-red-600">{errors.facts_snapshot.message}</p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="notes">Notes (optional)</Label>
        <Textarea id="notes" rows={3} {...register('notes')} />
        {errors.notes && (
          <p className="text-sm text-red-600">{errors.notes.message}</p>
        )}
      </div>

      {serverError && <p className="text-sm text-red-600">{serverError}</p>}

      <Button type="submit" disabled={isPending}>
        {isPending ? 'Saving…' : 'Add to golden set'}
      </Button>
    </form>
  )
}
