import { getTranslations } from 'next-intl/server'

import { AffexMark } from '@/components/brand/AffexMark'
import { SignupForm } from '@/components/auth/SignupForm'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

export default async function SignupPage() {
  const t = await getTranslations('auth')
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-6">
      <div dir="ltr" className="flex items-center gap-2.5">
        <AffexMark size={34} />
        <span style={{ fontFamily: 'var(--font-display)', fontSize: '26px', fontWeight: 700, letterSpacing: '0.02em' }}>
          AFF<span style={{ color: 'var(--primary)' }}>EX</span>
        </span>
      </div>
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>{t('signupTitle')}</CardTitle>
          <CardDescription>{t('signupSubtitle')}</CardDescription>
        </CardHeader>
        <CardContent>
          <SignupForm />
        </CardContent>
      </Card>
    </main>
  )
}
