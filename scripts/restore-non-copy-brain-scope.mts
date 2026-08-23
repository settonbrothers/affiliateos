import { readFileSync } from 'node:fs'

import { createClient } from '@supabase/supabase-js'

if (!process.argv.includes('--confirm-scope-repair')) {
  throw new Error(
    'Usage: pnpm brain:restore-scope -- --confirm-scope-repair'
  )
}

const env: Record<string, string> = {
  ...(process.env as Record<string, string>),
}
try {
  for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.+?)\s*$/)
    if (match) env[match[1]!] = match[2]!
  }
} catch {
  // Environment variables are an allowed alternative.
}
if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Supabase admin environment is required')
}

const repairs = [
  {
    orchestrator: 'DiagnosisOrchestrator',
    accidentalVersion: 'v2-brain-v3.31',
    restoreVersion: 'v1',
  },
  {
    orchestrator: 'AvatarBuilderOrchestrator',
    accidentalVersion: 'v3-brain-v3.31',
    restoreVersion: 'v1',
  },
] as const

const db = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
)

for (const repair of repairs) {
  const { data: accidental, error: accidentalError } = await db
    .from('prompts')
    .select('id,is_active')
    .eq('orchestrator_name', repair.orchestrator)
    .eq('prompt_type', 'main')
    .eq('version', repair.accidentalVersion)
    .is('vertical_id', null)
    .single()
  if (accidentalError) throw accidentalError

  const { data: previous, error: previousError } = await db
    .from('prompts')
    .select('id,is_active')
    .eq('orchestrator_name', repair.orchestrator)
    .eq('prompt_type', 'main')
    .eq('version', repair.restoreVersion)
    .is('vertical_id', null)
    .single()
  if (previousError) throw previousError

  if (accidental.is_active) {
    const { error } = await db
      .from('prompts')
      .update({ is_active: false })
      .eq('id', accidental.id)
    if (error) throw error
  }
  if (!previous.is_active) {
    const { error } = await db
      .from('prompts')
      .update({ is_active: true })
      .eq('id', previous.id)
    if (error) throw error
  }
  console.log(
    `RESTORED OUT-OF-SCOPE ${repair.orchestrator}/${repair.restoreVersion}`
  )
}
