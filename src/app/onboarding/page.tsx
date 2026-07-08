import { redirect } from 'next/navigation'

import { OnboardingWizard } from '@/components/onboarding/OnboardingWizard'
import { listVerticals } from '@/lib/queries/offers'
import { isOnboarded } from '@/lib/queries/onboarding'
import { createClient } from '@/lib/supabase/server'

// Standalone (outside the (app) group) so the app layout's onboarding gate can
// redirect here without looping. The wizard renders its own full-screen
// editorial sandwich (dark hero -> white body -> dark closing nav).
export default async function OnboardingPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  if (await isOnboarded()) redirect('/offers')

  const verticals = await listVerticals()

  return <OnboardingWizard verticals={verticals} />
}
