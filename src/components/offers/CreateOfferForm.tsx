'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useState, useTransition } from 'react'
import { useForm } from 'react-hook-form'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createOffer } from '@/lib/actions/offers'
import { OfferCreateSchema, type OfferCreateInput } from '@/lib/validations/offer'
import type { Vertical } from '@/types/db'

export function CreateOfferForm({ verticals }: { verticals: Vertical[] }) {
  const [isPending, startTransition] = useTransition()
  const [serverError, setServerError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<OfferCreateInput>({
    resolver: zodResolver(OfferCreateSchema),
    defaultValues: {
      name: '',
      vertical_id: '',
      website_url: '',
      affiliate_program_url: '',
    },
  })

  function onSubmit(values: OfferCreateInput) {
    setServerError(null)
    startTransition(async () => {
      const result = await createOffer(values)
      if (result && 'error' in result) setServerError(result.error)
    })
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="name">Name</Label>
        <Input id="name" {...register('name')} />
        {errors.name && (
          <p className="text-sm text-red-600">{errors.name.message}</p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="vertical_id">Vertical</Label>
        <select
          id="vertical_id"
          className="flex h-10 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-background)] px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]"
          {...register('vertical_id')}
        >
          <option value="">Select a vertical…</option>
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
        <Label htmlFor="website_url">Website URL</Label>
        <Input id="website_url" type="url" {...register('website_url')} />
        {errors.website_url && (
          <p className="text-sm text-red-600">{errors.website_url.message}</p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="affiliate_program_url">Affiliate program URL</Label>
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

      {serverError && <p className="text-sm text-red-600">{serverError}</p>}

      <Button type="submit" disabled={isPending}>
        {isPending ? 'Creating…' : 'Create offer'}
      </Button>
    </form>
  )
}
