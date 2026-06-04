'use server'

import { redirect } from 'next/navigation'

import { createClient } from '@/lib/supabase/server'
import {
  OnboardingSchema,
  type OnboardingInput,
} from '@/lib/validations/onboarding'

// Save the operator profile and mark onboarding complete, then enter the app.
// A "skip" submits an empty payload — onboarded_at is still set so the gate
// doesn't loop.
export async function saveOnboarding(
  input: OnboardingInput
): Promise<{ error: string } | void> {
  const parsed = OnboardingSchema.safeParse(input)
  if (!parsed.success) return { error: 'Some answers were invalid.' }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated.' }

  const { error } = await supabase.from('operator_profiles').upsert(
    {
      user_id: user.id,
      experience_level: parsed.data.experience_level ?? null,
      cashflow_tolerance: parsed.data.cashflow_tolerance ?? null,
      primary_channels: parsed.data.primary_channels,
      budget_min_usd: parsed.data.budget_min_usd ?? null,
      budget_max_usd: parsed.data.budget_max_usd ?? null,
      preferred_vertical_id: parsed.data.preferred_vertical_id || null,
      onboarded_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' }
  )
  if (error) return { error: error.message }

  redirect('/offers')
}
