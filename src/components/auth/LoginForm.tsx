'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { useState, useTransition } from 'react'
import { useForm } from 'react-hook-form'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { login, sendMagicLink } from '@/lib/actions/auth'
import { LoginSchema, type LoginInput } from '@/lib/validations/auth'

type ServerMessage = { type: 'error' | 'info'; text: string }

export function LoginForm() {
  const t = useTranslations('auth')
  const [isPending, startTransition] = useTransition()
  const [serverMessage, setServerMessage] = useState<ServerMessage | null>(null)

  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors },
  } = useForm<LoginInput>({
    resolver: zodResolver(LoginSchema),
    defaultValues: { email: '', password: '' },
  })

  function onSubmit(values: LoginInput) {
    setServerMessage(null)
    startTransition(async () => {
      const result = await login(values)
      if (result && 'error' in result) {
        setServerMessage({ type: 'error', text: result.error })
      }
    })
  }

  function onMagicLink() {
    setServerMessage(null)
    startTransition(async () => {
      const result = await sendMagicLink({ email: getValues('email') })
      setServerMessage(
        'error' in result
          ? { type: 'error', text: result.error }
          : { type: 'info', text: result.message }
      )
    })
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="email">{t('email')}</Label>
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
        <Label htmlFor="password">{t('password')}</Label>
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          {...register('password')}
        />
        {errors.password && (
          <p className="text-sm text-red-600">{errors.password.message}</p>
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
        {isPending ? t('signingIn') : t('signInBtn')}
      </Button>
      <Button
        type="button"
        variant="outline"
        onClick={onMagicLink}
        disabled={isPending}
      >
        {t('sendMagicLink')}
      </Button>

      <p className="text-center text-sm text-[var(--color-muted-foreground)]">
        {t('noAccount')}{' '}
        <Link href="/signup" className="underline">
          {t('signUpLink')}
        </Link>
      </p>
    </form>
  )
}
