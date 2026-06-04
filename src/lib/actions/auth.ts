'use server'

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'

import { isInviteCodeValid, type InviteCodeRow } from '@/lib/invites'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import {
  LoginSchema,
  MagicLinkSchema,
  SignupSchema,
  type LoginInput,
  type MagicLinkInput,
  type SignupInput,
} from '@/lib/validations/auth'

export type AuthActionResult = { error: string } | { message: string }

async function siteOrigin() {
  const h = await headers()
  return h.get('origin') ?? process.env.NEXT_PUBLIC_SITE_URL ?? ''
}

export async function login(input: LoginInput): Promise<AuthActionResult> {
  const parsed = LoginSchema.safeParse(input)
  if (!parsed.success) return { error: 'Invalid email or password.' }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword(parsed.data)
  if (error) return { error: error.message }

  redirect('/offers')
}

export async function signup(input: SignupInput): Promise<AuthActionResult> {
  const parsed = SignupSchema.safeParse(input)
  if (!parsed.success) return { error: 'Invalid email, password, or invite code.' }

  // Invite-only: validate the code before creating the account. The user is
  // anonymous here, so this (and the redemption below) runs as the service role.
  const admin = createAdminClient()
  const { data: code } = await admin
    .from('invite_codes')
    .select('id, code, bonus_credits, max_uses, uses, expires_at, revoked')
    .eq('code', parsed.data.invite_code.trim())
    .maybeSingle()
  const validity = isInviteCodeValid(code as InviteCodeRow | null, new Date())
  if (!validity.valid) return { error: validity.reason }
  const inviteCode = code as InviteCodeRow

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: { emailRedirectTo: `${await siteOrigin()}/callback` },
  })
  if (error) return { error: error.message }

  // Redeem: grant bonus credits to the new workspace + record the redemption.
  // The signup trigger has already created the workspace synchronously.
  const userId = data.user?.id
  if (userId) {
    const { data: mem } = await admin
      .from('workspace_members')
      .select('workspace_id')
      .eq('user_id', userId)
      .maybeSingle()
    const workspaceId = mem?.workspace_id ?? null
    if (workspaceId && inviteCode.bonus_credits > 0) {
      await admin.from('credit_ledger').insert({
        workspace_id: workspaceId,
        entry_type: 'granted',
        amount: inviteCode.bonus_credits,
        reason: `Invite bonus (${inviteCode.code})`,
      })
    }
    await admin.from('invite_redemptions').insert({
      invite_code_id: inviteCode.id,
      user_id: userId,
      workspace_id: workspaceId,
      credits_granted: workspaceId ? inviteCode.bonus_credits : 0,
    })
    await admin
      .from('invite_codes')
      .update({ uses: inviteCode.uses + 1 })
      .eq('id', inviteCode.id)
  }

  if (data.session) redirect('/offers')
  return { message: 'Check your email to confirm your account.' }
}

export async function sendMagicLink(
  input: MagicLinkInput
): Promise<AuthActionResult> {
  const parsed = MagicLinkSchema.safeParse(input)
  if (!parsed.success) return { error: 'Enter a valid email address.' }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data.email,
    options: { emailRedirectTo: `${await siteOrigin()}/callback` },
  })
  if (error) return { error: error.message }

  return { message: 'Magic link sent. Check your email.' }
}

export async function signOut(): Promise<void> {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}
