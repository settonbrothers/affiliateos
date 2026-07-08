'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { useState, useTransition } from 'react'
import { useForm } from 'react-hook-form'

import { signup } from '@/lib/actions/auth'
import { SignupSchema, type SignupInput } from '@/lib/validations/auth'

type ServerMessage = { type: 'error' | 'info'; text: string }

export function SignupForm() {
  const t = useTranslations('auth')
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
      <div>
        <h2 style={{ margin: '0 0 4px', fontFamily: 'var(--font-display)', fontSize: '24px', fontWeight: 600, color: '#1F1B16' }}>
          {t('signupTitle')}
        </h2>
        <p style={{ margin: 0, fontSize: '13px', color: '#6B6459' }}>{t('signupSubtitle')}</p>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="email" className="affex-light-label">{t('email')}</label>
        <input id="email" type="email" autoComplete="email" className="affex-light-field" {...register('email')} />
        {errors.email && <p style={{ fontSize: '13px', color: '#B23A24' }}>{errors.email.message}</p>}
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="password" className="affex-light-label">{t('password')}</label>
        <input id="password" type="password" autoComplete="new-password" className="affex-light-field" {...register('password')} />
        {errors.password && <p style={{ fontSize: '13px', color: '#B23A24' }}>{errors.password.message}</p>}
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="invite_code" className="affex-light-label">{t('inviteCode')}</label>
        <input id="invite_code" autoComplete="off" className="affex-light-field" {...register('invite_code')} />
        {errors.invite_code && <p style={{ fontSize: '13px', color: '#B23A24' }}>{errors.invite_code.message}</p>}
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
        {isPending ? t('creatingAccount') : t('createAccountBtn')}
      </button>

      <p style={{ textAlign: 'center', fontSize: '13px', color: '#6B6459' }}>
        {t('haveAccount')}{' '}
        <Link href="/login" style={{ color: '#9A6B00', textDecoration: 'underline' }}>
          {t('signInLink')}
        </Link>
      </p>
    </form>
  )
}
