import { readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

import { createClient } from '@supabase/supabase-js'

import { isCopyBrainRuntimeOrchestrator } from './copy-brain-scope.mts'

const argv = process.argv.slice(2)
const valueAfter = (flag: string) => {
  const index = argv.indexOf(flag)
  return index >= 0 ? argv[index + 1] : null
}
const evalRun = valueAfter('--eval-run')
const manifestPath = valueAfter('--package')
const ownerApproved = argv.includes('--confirm-owner-approved')
const evalDeferred = argv.includes('--confirm-eight-case-eval-deferred')

if (
  !manifestPath ||
  !ownerApproved ||
  (!evalRun && !evalDeferred) ||
  (evalRun && evalDeferred)
) {
  throw new Error(
    'Usage: pnpm brain:release -- --package <manifest.json> --confirm-owner-approved (--eval-run <id> | --confirm-eight-case-eval-deferred)'
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

const manifest = JSON.parse(readFileSync(resolve(manifestPath), 'utf8')) as {
  release_version: string
  activation: string
  activation_decision?: {
    owner?: string
    approved_at?: string
    required_before_external_users?: string
    rollback_required?: boolean
  }
  manifest_sha256: string
  files: Array<{
    kind: string
    orchestrator?: string
    version?: string
  }>
}

if (evalDeferred) {
  if (
    manifest.activation !==
      'owner_approved_full_affx_activation_pending_smoke' ||
    manifest.activation_decision?.owner !== 'Noam Zluf' ||
    manifest.activation_decision?.approved_at !== '2026-08-23' ||
    manifest.activation_decision?.required_before_external_users !==
      'clean_8_case_eval' ||
    manifest.activation_decision?.rollback_required !== true
  ) {
    throw new Error(
      'The signed release does not contain the exact owner-approved deferred-eval activation decision.'
    )
  }
}

const db = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
)

if (evalRun) {
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
}

type PromptRow = {
  id: string
  orchestrator_name: string
  version: string
  is_active: boolean
}
const planned: Array<{
  orchestrator: string
  target: PromptRow
  previous: PromptRow | null
}> = []

for (const file of manifest.files.filter(
  (item) =>
    item.kind === 'prompt' && isCopyBrainRuntimeOrchestrator(item.orchestrator)
)) {
  if (!file.orchestrator || !file.version) {
    throw new Error('Prompt metadata missing')
  }
  const { data: target, error: targetError } = await db
    .from('prompts')
    .select('id,orchestrator_name,version,is_active')
    .eq('orchestrator_name', file.orchestrator)
    .eq('version', file.version)
    .eq('prompt_type', 'main')
    .is('vertical_id', null)
    .single()
  if (targetError) throw targetError
  const { data: previous, error: previousError } = await db
    .from('prompts')
    .select('id,orchestrator_name,version,is_active')
    .eq('orchestrator_name', file.orchestrator)
    .eq('prompt_type', 'main')
    .eq('is_active', true)
    .is('vertical_id', null)
    .maybeSingle()
  if (previousError) throw previousError
  planned.push({
    orchestrator: file.orchestrator,
    target: target as PromptRow,
    previous: (previous as PromptRow | null) ?? null,
  })
}

const rollbackPath = join(
  resolve(import.meta.dirname, '..'),
  'brain-release',
  `rollback-${manifest.release_version}.json`
)
writeFileSync(
  rollbackPath,
  `${JSON.stringify(
    {
      schema_version: 'copy-brain-rollback-v1',
      release_version: manifest.release_version,
      manifest_sha256: manifest.manifest_sha256,
      created_at: new Date().toISOString(),
      prompts: planned.map(({ orchestrator, target, previous }) => ({
        orchestrator,
        activated_prompt_id: target.id,
        activated_version: target.version,
        previous_prompt_id: previous?.id ?? null,
        previous_version: previous?.version ?? null,
      })),
    },
    null,
    2
  )}\n`
)
console.log(`ROLLBACK SNAPSHOT ${rollbackPath}`)

const restorePrevious = async () => {
  for (const item of planned) {
    const { error: deactivateError } = await db
      .from('prompts')
      .update({ is_active: false })
      .eq('orchestrator_name', item.orchestrator)
      .eq('prompt_type', 'main')
      .is('vertical_id', null)
    if (deactivateError) throw deactivateError
    if (item.previous) {
      const { error: restoreError } = await db
        .from('prompts')
        .update({ is_active: true })
        .eq('id', item.previous.id)
      if (restoreError) throw restoreError
    }
  }
}

try {
  for (const item of planned) {
    if (item.target.is_active) continue
    const { error: deactivateError } = await db
      .from('prompts')
      .update({ is_active: false })
      .eq('orchestrator_name', item.orchestrator)
      .eq('prompt_type', 'main')
      .is('vertical_id', null)
    if (deactivateError) throw deactivateError
    const { error: activateError } = await db
      .from('prompts')
      .update({ is_active: true })
      .eq('id', item.target.id)
    if (activateError) throw activateError
    console.log(`ACTIVATED ${item.orchestrator}/${item.target.version}`)
  }
} catch (error) {
  await restorePrevious()
  throw new Error(
    `Activation failed and previous prompts were restored: ${error instanceof Error ? error.message : String(error)}`
  )
}

console.log(
  evalDeferred
    ? 'Prompts activated under the signed owner decision. The clean eight-case eval remains required before external users.'
    : `Prompts activated after passed eval ${evalRun}.`
)
