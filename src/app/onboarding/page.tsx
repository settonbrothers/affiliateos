import { getTranslations } from 'next-intl/server'
import { redirect } from 'next/navigation'

import { OnboardingWizard } from '@/components/onboarding/OnboardingWizard'
import { listVerticals } from '@/lib/queries/offers'
import { isOnboarded } from '@/lib/queries/onboarding'
import { createClient } from '@/lib/supabase/server'

// Standalone (outside the (app) group) so the app layout's onboarding gate can
// redirect here without looping.
export default async function OnboardingPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  if (await isOnboarded()) redirect('/offers')

  const verticals = await listVerticals()
  const t = await getTranslations('onboarding')

  return (
    <div className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">{t('welcomeTitle')}</h1>
        <p className="text-sm text-[var(--color-muted-foreground)]">
          {t('welcomeSubtitle')}
        </p>
      </div>
      <OnboardingWizard verticals={verticals} />
    </div>
  )
}
