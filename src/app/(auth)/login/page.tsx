import { getTranslations } from 'next-intl/server'

import { LoginForm } from '@/components/auth/LoginForm'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

export default async function LoginPage() {
  const t = await getTranslations('auth')
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-6">
      <div dir="ltr" className="flex items-center gap-2.5">
        <span style={{ fontFamily: 'var(--font-display)', fontSize: '26px', fontWeight: 700, letterSpacing: '0.02em' }}>
          AFF<span style={{ color: 'var(--primary)' }}>EX</span>
        </span>
      </div>
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>{t('signInTitle')}</CardTitle>
          <CardDescription>{t('signInSubtitle')}</CardDescription>
        </CardHeader>
        <CardContent>
          <LoginForm />
        </CardContent>
      </Card>
    </main>
  )
}
