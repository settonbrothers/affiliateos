'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { isCurrentUserAdmin } from '@/lib/auth/role'
import { formatInviteCode } from '@/lib/invites'
import { createClient } from '@/lib/supabase/server'

export const GenerateInviteSchema = z.object({
  bonus_credits: z.coerce.number().int().min(0).max(100000),
  max_uses: z.coerce.number().int().min(1).max(10000),
  expires_days: z.coerce.number().int().min(1).max(3650).optional().or(z.literal('')),
})
export type GenerateInviteInput = z.infer<typeof GenerateInviteSchema>

export async function generateInviteCode(
  input: GenerateInviteInput
): Promise<{ error: string } | { code: string }> {
  const parsed = GenerateInviteSchema.safeParse(input)
  if (!parsed.success) return { error: 'Check the values.' }
  if (!(await isCurrentUserAdmin())) return { error: 'Admin only.' }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const code = formatInviteCode(crypto.getRandomValues(new Uint8Array(10)))
  const expiresDays = Number(parsed.data.expires_days) || 0
  const expiresAt =
    expiresDays > 0
      ? new Date(Date.now() + expiresDays * 86_400_000).toISOString()
      : null

  const { error } = await supabase.from('invite_codes').insert({
    code,
    bonus_credits: parsed.data.bonus_credits,
    max_uses: parsed.data.max_uses,
    expires_at: expiresAt,
    created_by: user?.id ?? null,
  })
  if (error) return { error: error.message }

  revalidatePath('/admin/invite-codes')
  return { code }
}

export async function revokeInviteCode(
  id: string
): Promise<{ error: string } | void> {
  if (!(await isCurrentUserAdmin())) return { error: 'Admin only.' }
  const supabase = await createClient()
  const { error } = await supabase
    .from('invite_codes')
    .update({ revoked: true })
    .eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/admin/invite-codes')
}
