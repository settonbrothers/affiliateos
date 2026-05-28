'use server'

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'

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
  if (!parsed.success) return { error: 'Invalid email or password.' }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: { emailRedirectTo: `${await siteOrigin()}/callback` },
  })
  if (error) return { error: error.message }
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
