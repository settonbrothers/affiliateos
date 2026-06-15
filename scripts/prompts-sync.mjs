// scripts/prompts-sync.mjs
// Sync prompts/<orchestrator>/<version>.md files into the prompts DB table.
// Reads NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY from .env.local
// when present (local dev); otherwise falls back to process.env (CI).
//
// Behavior:
// - For each prompts/<dir>/<version>.md, upsert a row (orchestrator_name,
//   prompt_type='main', version, vertical_id=null, content).
// - If no version for that (orchestrator, type, vertical) is is_active=true yet,
//   the just-inserted row becomes active. Existing active rows are never
//   silently flipped — use the /admin/prompts UI for that.

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

import { createClient } from '@supabase/supabase-js'

// Start from process.env (CI), then let a local .env.local override it if present.
const env = { ...process.env }
try {
  for (const line of readFileSync('.env.local', 'utf-8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.+?)\s*$/)
    if (m) env[m[1]] = m[2]
  }
} catch {
  // No .env.local (e.g. CI) — process.env is used as-is.
}

const URL = env.NEXT_PUBLIC_SUPABASE_URL
const SR = env.SUPABASE_SERVICE_ROLE_KEY
if (!URL || !SR) {
  console.error(
    'prompts-sync: missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY (.env.local or env)'
  )
  process.exit(1)
}

const supabase = createClient(URL, SR, { auth: { persistSession: false } })

const PROMPTS_DIR = 'prompts'

function toOrchestratorName(folder) {
  // 'underwriting' -> 'UnderwritingOrchestrator'
  // 'source_extraction' -> 'SourceExtractionOrchestrator'
  const camel = folder
    .split(/[-_]/)
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join('')
  return `${camel}Orchestrator`
}

const entries = []
let dirs
try {
  dirs = readdirSync(PROMPTS_DIR)
} catch {
  console.log(`No ${PROMPTS_DIR}/ directory yet — nothing to sync.`)
  process.exit(0)
}

for (const item of dirs) {
  const dir = join(PROMPTS_DIR, item)
  if (!statSync(dir).isDirectory()) continue
  for (const file of readdirSync(dir)) {
    if (!file.endsWith('.md')) continue
    const version = file.replace(/\.md$/, '')
    const content = readFileSync(join(dir, file), 'utf-8')
    entries.push({
      orchestratorName: toOrchestratorName(item),
      version,
      content,
    })
  }
}

console.log(`Found ${entries.length} prompt file(s).`)

let updated = 0
let inserted = 0
let activated = 0

for (const e of entries) {
  const { data: existing, error: selErr } = await supabase
    .from('prompts')
    .select('id')
    .eq('orchestrator_name', e.orchestratorName)
    .eq('prompt_type', 'main')
    .eq('version', e.version)
    .is('vertical_id', null)
    .maybeSingle()

  if (selErr) {
    console.error(`  ${e.orchestratorName}/${e.version}: select failed — ${selErr.message}`)
    process.exitCode = 1
    continue
  }

  if (existing) {
    const { error } = await supabase
      .from('prompts')
      .update({ content: e.content })
      .eq('id', existing.id)
    if (error) {
      console.error(`  ${e.orchestratorName}/${e.version}: update failed — ${error.message}`)
      process.exitCode = 1
      continue
    }
    console.log(`  updated  ${e.orchestratorName}/${e.version}`)
    updated++
  } else {
    const { data: hasActive } = await supabase
      .from('prompts')
      .select('id')
      .eq('orchestrator_name', e.orchestratorName)
      .eq('prompt_type', 'main')
      .is('vertical_id', null)
      .eq('is_active', true)
      .maybeSingle()

    const isActive = !hasActive
    const { error } = await supabase.from('prompts').insert({
      orchestrator_name: e.orchestratorName,
      prompt_type: 'main',
      version: e.version,
      content: e.content,
      is_active: isActive,
    })
    if (error) {
      console.error(`  ${e.orchestratorName}/${e.version}: insert failed — ${error.message}`)
      process.exitCode = 1
      continue
    }
    console.log(`  inserted ${e.orchestratorName}/${e.version}${isActive ? '  (active)' : ''}`)
    inserted++
    if (isActive) activated++
  }
}

console.log(
  `Done. ${inserted} inserted (${activated} marked active), ${updated} updated.`
)
