'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useState, useTransition } from 'react'
import { useForm } from 'react-hook-form'

import { login, sendMagicLink } from '@/lib/actions/auth'
import { LoginSchema, type LoginInput } from '@/lib/validations/auth'

type ServerMessage = { type: 'error' | 'info'; text: string }

export function LoginForm() {
  const t = useTranslations('auth')
  const searchParams = useSearchParams()
  const urlError = searchParams.get('error')
  const next = searchParams.get('next') ?? undefined
  const [isPending, startTransition] = useTransition()
  const [serverMessage, setServerMessage] = useState<ServerMessage | null>(
    urlError ? { type: 'error', text: urlError } : null
  )

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
      const result = await login(values, next)
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
      <div>
        <h2 style={{ margin: '0 0 4px', fontFamily: 'var(--font-display)', fontSize: '24px', fontWeight: 600, color: '#1F1B16' }}>
          {t('signInTitle')}
        </h2>
        <p style={{ margin: 0, fontSize: '13px', color: '#6B6459' }}>{t('signInSubtitle')}</p>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="email" className="affex-light-label">{t('email')}</label>
        <input id="email" type="email" autoComplete="email" className="affex-light-field" {...register('email')} />
        {errors.email && <p style={{ fontSize: '13px', color: '#B23A24' }}>{errors.email.message}</p>}
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="password" className="affex-light-label">{t('password')}</label>
        <input id="password" type="password" autoComplete="current-password" className="affex-light-field" {...register('password')} />
        {errors.password && <p style={{ fontSize: '13px', color: '#B23A24' }}>{errors.password.message}</p>}
      </div>

      {serverMessage && (
        <p style={{ fontSize: '13px', color: serverMessage.type === 'error' ? '#B23A24' : '#6B6459' }}>
          {serverMessage.text}
        </p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="affex-cta"
        style={{ fontFamily: 'var(--font-sans)', fontWeight: 700, color: '#0A0A0A', background: '#F5C518', border: 'none', padding: '12px 18px', cursor: isPending ? 'default' : 'pointer', opacity: isPending ? 0.6 : 1 }}
      >
        {isPending ? t('signingIn') : t('signInBtn')}
      </button>
      <button
        type="button"
        onClick={onMagicLink}
        disabled={isPending}
        style={{ fontFamily: 'var(--font-sans)', fontWeight: 600, color: '#1F1B16', background: 'transparent', border: '1px solid #DED8CB', padding: '12px 18px', cursor: isPending ? 'default' : 'pointer' }}
      >
        {t('sendMagicLink')}
      </button>

      <p style={{ textAlign: 'center', fontSize: '13px', color: '#6B6459' }}>
        {t('noAccount')}{' '}
        <Link href="/signup" style={{ color: '#9A6B00', textDecoration: 'underline' }}>
          {t('signUpLink')}
        </Link>
      </p>
    </form>
  )
}
