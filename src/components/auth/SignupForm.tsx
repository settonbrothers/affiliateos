'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import Link from 'next/link'
import { useState, useTransition } from 'react'
import { useForm } from 'react-hook-form'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { signup } from '@/lib/actions/auth'
import { SignupSchema, type SignupInput } from '@/lib/validations/auth'

type ServerMessage = { type: 'error' | 'info'; text: string }

export function SignupForm() {
  const [isPending, startTransition] = useTransition()
  const [serverMessage, setServerMessage] = useState<ServerMessage | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SignupInput>({
    resolver: zodResolver(SignupSchema),
    defaultValues: { email: '', password: '', invite_code: '' },
  })

  function onSubmit(values: SignupInput) {
    setServerMessage(null)
    startTransition(async () => {
      const result = await signup(values)
      if (result && 'error' in result) {
        setServerMessage({ type: 'error', text: result.error })
      } else if (result && 'message' in result) {
        setServerMessage({ type: 'info', text: result.message })
      }
    })
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          {...register('email')}
        />
        {errors.email && (
          <p className="text-sm text-red-600">{errors.email.message}</p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          type="password"
          autoComplete="new-password"
          {...register('password')}
        />
        {errors.password && (
          <p className="text-sm text-red-600">{errors.password.message}</p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="invite_code">Invite code</Label>
        <Input id="invite_code" autoComplete="off" {...register('invite_code')} />
        {errors.invite_code && (
          <p className="text-sm text-red-600">{errors.invite_code.message}</p>
        )}
      </div>

      {serverMessage && (
        <p
          className={
            serverMessage.type === 'error'
              ? 'text-sm text-red-600'
              : 'text-sm text-[var(--color-muted-foreground)]'
          }
        >
          {serverMessage.text}
        </p>
      )}

      <Button type="submit" disabled={isPending}>
        {isPending ? 'Creating account…' : 'Create account'}
      </Button>

      <p className="text-center text-sm text-[var(--color-muted-foreground)]">
        Already have an account?{' '}
        <Link href="/login" className="underline">
          Sign in
        </Link>
      </p>
    </form>
  )
}
