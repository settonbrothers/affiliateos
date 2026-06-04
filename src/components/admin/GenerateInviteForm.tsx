'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useState, useTransition } from 'react'
import { useForm } from 'react-hook-form'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  generateInviteCode,
  GenerateInviteSchema,
  type GenerateInviteInput,
} from '@/lib/actions/invites'

export function GenerateInviteForm() {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [created, setCreated] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<GenerateInviteInput>({
    resolver: zodResolver(GenerateInviteSchema),
    defaultValues: { bonus_credits: 50, max_uses: 1, expires_days: '' },
  })

  function onSubmit(values: GenerateInviteInput) {
    setError(null)
    setCreated(null)
    startTransition(async () => {
      const result = await generateInviteCode(values)
      if ('error' in result) setError(result.error)
      else setCreated(result.code)
    })
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="flex flex-wrap items-end gap-3"
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="bonus_credits">Bonus credits</Label>
        <Input
          id="bonus_credits"
          type="number"
          className="w-32"
          {...register('bonus_credits')}
        />
        {errors.bonus_credits && (
          <p className="text-sm text-red-600">{errors.bonus_credits.message}</p>
        )}
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="max_uses">Max uses</Label>
        <Input id="max_uses" type="number" className="w-24" {...register('max_uses')} />
        {errors.max_uses && (
          <p className="text-sm text-red-600">{errors.max_uses.message}</p>
        )}
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="expires_days">Expires (days)</Label>
        <Input
          id="expires_days"
          type="number"
          className="w-28"
          placeholder="never"
          {...register('expires_days')}
        />
      </div>
      <Button type="submit" disabled={isPending}>
        {isPending ? 'Generating…' : 'Generate code'}
      </Button>
      {created && (
        <p className="text-sm">
          New code: <span className="font-mono font-semibold">{created}</span>
        </p>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </form>
  )
}
