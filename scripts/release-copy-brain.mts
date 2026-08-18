import { readFileSync } from 'node:fs'

import { createClient } from '@supabase/supabase-js'

const argv = process.argv.slice(2)
const evalIndex = argv.indexOf('--eval-run')
const packageIndex = argv.indexOf('--package')
const evalRun = evalIndex >= 0 ? argv[evalIndex + 1] : null
const manifestPath = packageIndex >= 0 ? argv[packageIndex + 1] : null
if (!evalRun || !manifestPath || !argv.includes('--confirm-owner-approved')) {
  throw new Error(
    'Usage: pnpm brain:release -- --package <manifest.json> --eval-run <id> --confirm-owner-approved'
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
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as {
  manifest_sha256: string
  files: Array<{
    kind: string
    orchestrator?: string
    version?: string
  }>
}
const db = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
)
const { data: run, error: runError } = await db
  .from('copy_eval_runs')
  .select('status,prompt_manifest_sha256')
  .eq('id', evalRun)
  .single()
if (runError) throw runError
if (run.status !== 'passed') {
  throw new Error(`Eval ${evalRun} is ${run.status}, not passed`)
}
if (run.prompt_manifest_sha256 !== manifest.manifest_sha256) {
  throw new Error('Eval manifest does not match the release manifest')
}
for (const file of manifest.files.filter((item) => item.kind === 'prompt')) {
  if (!file.orchestrator || !file.version) {
    throw new Error('Prompt metadata missing')
  }
  const { data: target, error } = await db
    .from('prompts')
    .select('id,is_active')
    .eq('orchestrator_name', file.orchestrator)
    .eq('version', file.version)
    .eq('prompt_type', 'main')
    .is('vertical_id', null)
    .single()
  if (error) throw error
  if (target.is_active) continue
  const { error: deactivateError } = await db
    .from('prompts')
    .update({ is_active: false })
    .eq('orchestrator_name', file.orchestrator)
    .eq('prompt_type', 'main')
    .is('vertical_id', null)
  if (deactivateError) throw deactivateError
  const { error: activateError } = await db
    .from('prompts')
    .update({ is_active: true })
    .eq('id', target.id)
  if (activateError) throw activateError
  console.log(`ACTIVATED ${file.orchestrator}/${file.version}`)
}
console.log(
  'Prompts activated. Deploy only allowlisted copy functions/UI, then enable the two evidence flags admin-only.'
)
