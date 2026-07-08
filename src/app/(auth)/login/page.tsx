import { getTranslations } from 'next-intl/server'

import { AuthEditorialShell } from '@/components/auth/AuthEditorialShell'
import { LoginForm } from '@/components/auth/LoginForm'

export default async function LoginPage() {
  const t = await getTranslations('auth')
  return <AuthEditorialShell statement={t('statementSignIn')} form={<LoginForm />} />
}
