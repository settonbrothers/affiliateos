'use server'

import { revalidatePath } from 'next/cache'

import { isCurrentUserAdmin } from '@/lib/auth/role'
import { createClient } from '@/lib/supabase/server'

export type ReplayResult = { error: string } | { ok: true }

// Replays a dead-lettered unit of work. Today only 'ai_run' messages produced
// by analyze-offer are replayable — re-invoking the edge fn with the stored
// offer_id. Other message types (webhook/email/stripe, post-MVP) have no
// replayer yet and are rejected explicitly.
export async function replayFailedMessage(id: string): Promise<ReplayResult> {
  if (!(await isCurrentUserAdmin())) return { error: 'Admin only.' }

  const supabase = await createClient()
  const { data: msg, error: readErr } = await supabase
    .from('failed_messages')
    .select('id, message_type, payload, attempts, max_attempts, status')
    .eq('id', id)
    .maybeSingle()
  if (readErr) return { error: readErr.message }
  if (!msg) return { error: 'Message not found.' }
  if (msg.status === 'succeeded') return { error: 'Already succeeded.' }

  const payload = (msg.payload ?? {}) as { kind?: string; offer_id?: string }
  if (
    msg.message_type !== 'ai_run' ||
    payload.kind !== 'analyze-offer' ||
    !payload.offer_id
  ) {
    return { error: `No replayer for message_type='${msg.message_type}'.` }
  }

  const now = () => new Date().toISOString()
  await supabase
    .from('failed_messages')
    .update({ status: 'retrying', updated_at: now() })
    .eq('id', id)

  const { error: invokeErr } = await supabase.functions.invoke('analyze-offer', {
    body: { offer_id: payload.offer_id },
  })

  const attempts = (msg.attempts ?? 0) + 1
  if (invokeErr) {
    const abandoned = attempts >= (msg.max_attempts ?? 3)
    await supabase
      .from('failed_messages')
      .update({
        status: abandoned ? 'abandoned' : 'pending',
        attempts,
        last_error: invokeErr.message,
        updated_at: now(),
      })
      .eq('id', id)
    revalidatePath('/admin/failed')
    return { error: invokeErr.message }
  }

  await supabase
    .from('failed_messages')
    .update({ status: 'succeeded', attempts, updated_at: now() })
    .eq('id', id)
  revalidatePath('/admin/failed')
  return { ok: true }
}
