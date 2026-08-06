// scripts/prompts-sync.mjs
// Sync prompts/<orchestrator>/<version>.md files into the prompts DB table.
// Reads NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY from .env.local
// when present (local dev); otherwise falls back to process.env (CI).
//
// Behavior:
// - For each prompts/<dir>/<version>.md, upsert a row (orchestrator_name,
//   prompt_type='main', version, vertical_id=null, content).
// - prompts/<dir>/_active.json ({"version": "v3"}) declares which version is
//   meant to be live. If nothing is active yet, that version is activated
//   (falling back to the highest vN when no _active.json exists).
// - Existing active rows are never silently flipped — use the /admin/prompts
//   UI for that. A mismatch between _active.json and the DB is reported as
//   DRIFT and exits non-zero, so the declared version stays honest.

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

// Natural version order so 'v10' sorts after 'v9' (plain string sort doesn't).
function versionRank(v) {
  const m = /^v(\d+)$/.exec(v)
  return m ? Number(m[1]) : -1
}

const entries = []
// orchestrator_name -> version declared in prompts/<dir>/_active.json
const declaredActive = new Map()
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
  const orchestratorName = toOrchestratorName(item)
  try {
    const declared = JSON.parse(readFileSync(join(dir, '_active.json'), 'utf-8'))
    if (declared?.version) declaredActive.set(orchestratorName, declared.version)
  } catch {
    // No _active.json (or unreadable) — the highest version is the fallback.
  }
  for (const file of readdirSync(dir)) {
    if (!file.endsWith('.md')) continue
    const version = file.replace(/\.md$/, '')
    const content = readFileSync(join(dir, file), 'utf-8')
    entries.push({
      orchestratorName,
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
    // Always insert inactive. Which version is live is decided once per
    // orchestrator below, from _active.json — not by whichever file happened
    // to be read first (that made 'v1' win alphabetically over 'v3').
    const { error } = await supabase.from('prompts').insert({
      orchestrator_name: e.orchestratorName,
      prompt_type: 'main',
      version: e.version,
      content: e.content,
      is_active: false,
    })
    if (error) {
      console.error(`  ${e.orchestratorName}/${e.version}: insert failed — ${error.message}`)
      process.exitCode = 1
      continue
    }
    console.log(`  inserted ${e.orchestratorName}/${e.version}`)
    inserted++
  }
}

// Reconcile which version is live, per orchestrator.
// - Nothing active yet  -> activate the declared version (or the highest one).
// - Active matches      -> nothing to do.
// - Active differs      -> report and fail. Flipping a live prompt is a
//   deliberate act through /admin/prompts, never a side effect of a sync.
const byOrchestrator = new Map()
for (const e of entries) {
  if (!byOrchestrator.has(e.orchestratorName)) byOrchestrator.set(e.orchestratorName, [])
  byOrchestrator.get(e.orchestratorName).push(e.version)
}

let drifted = 0
for (const [orchestratorName, versions] of byOrchestrator) {
  const highest = [...versions].sort((a, b) => versionRank(b) - versionRank(a))[0]
  const declared = declaredActive.get(orchestratorName)
  if (declared && !versions.includes(declared)) {
    console.error(
      `  ${orchestratorName}: _active.json declares ${declared} but no ${declared}.md exists`
    )
    process.exitCode = 1
    continue
  }
  const intended = declared ?? highest

  const { data: active, error: activeErr } = await supabase
    .from('prompts')
    .select('id, version')
    .eq('orchestrator_name', orchestratorName)
    .eq('prompt_type', 'main')
    .is('vertical_id', null)
    .eq('is_active', true)
    .maybeSingle()
  if (activeErr) {
    console.error(`  ${orchestratorName}: active lookup failed — ${activeErr.message}`)
    process.exitCode = 1
    continue
  }

  if (!active) {
    const { error } = await supabase
      .from('prompts')
      .update({ is_active: true })
      .eq('orchestrator_name', orchestratorName)
      .eq('prompt_type', 'main')
      .is('vertical_id', null)
      .eq('version', intended)
    if (error) {
      console.error(`  ${orchestratorName}: activate ${intended} failed — ${error.message}`)
      process.exitCode = 1
      continue
    }
    console.log(`  activated ${orchestratorName}/${intended}`)
    activated++
  } else if (declared && active.version !== declared) {
    console.error(
      `  DRIFT ${orchestratorName}: _active.json says ${declared}, DB has ${active.version} live. ` +
        `Flip it in /admin/prompts (or correct _active.json).`
    )
    drifted++
    process.exitCode = 1
  }
}

console.log(
  `Done. ${inserted} inserted, ${activated} activated, ${updated} updated` +
    (drifted > 0 ? `, ${drifted} DRIFTED` : '') +
    '.'
)
