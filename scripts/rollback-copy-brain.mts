import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { createClient } from '@supabase/supabase-js'

const argv = process.argv.slice(2)
const snapshotIndex = argv.indexOf('--snapshot')
const snapshotPath = snapshotIndex >= 0 ? argv[snapshotIndex + 1] : null
if (!snapshotPath || !argv.includes('--confirm-rollback')) {
  throw new Error(
    'Usage: pnpm brain:rollback -- --snapshot <rollback.json> --confirm-rollback'
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

const snapshot = JSON.parse(readFileSync(resolve(snapshotPath), 'utf8')) as {
  schema_version: string
  release_version: string
  prompts: Array<{
    orchestrator: string
    activated_prompt_id: string
    previous_prompt_id: string | null
    previous_version: string | null
  }>
}
if (snapshot.schema_version !== 'copy-brain-rollback-v1') {
  throw new Error('Unsupported rollback snapshot')
}

const db = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
)
for (const item of snapshot.prompts) {
  const { error: deactivateError } = await db
    .from('prompts')
    .update({ is_active: false })
    .eq('orchestrator_name', item.orchestrator)
    .eq('prompt_type', 'main')
    .is('vertical_id', null)
  if (deactivateError) throw deactivateError
  if (item.previous_prompt_id) {
    const { error: restoreError } = await db
      .from('prompts')
      .update({ is_active: true })
      .eq('id', item.previous_prompt_id)
    if (restoreError) throw restoreError
  }
  console.log(
    `RESTORED ${item.orchestrator}/${item.previous_version ?? 'no-active-version'}`
  )
}
console.log(`ROLLBACK COMPLETE ${snapshot.release_version}`)
