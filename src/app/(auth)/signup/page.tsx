import { getTranslations } from 'next-intl/server'

import { AuthEditorialShell } from '@/components/auth/AuthEditorialShell'
import { SignupForm } from '@/components/auth/SignupForm'

export default async function SignupPage() {
  const t = await getTranslations('auth')
  return <AuthEditorialShell statement={t('statementSignUp')} form={<SignupForm />} />
}
