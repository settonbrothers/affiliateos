import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'

import { createClient } from '@supabase/supabase-js'

import { isCopyBrainRuntimeOrchestrator } from './copy-brain-scope.mts'

const argv = process.argv.slice(2)
const packageIndex = argv.indexOf('--package')
const rawManifestPath = packageIndex >= 0 ? argv[packageIndex + 1] : null
if (!rawManifestPath) {
  throw new Error('Usage: pnpm brain:stage -- --package <manifest.json>')
}
const manifestPath = resolve(rawManifestPath)
const repoRoot = resolve(import.meta.dirname, '..')
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
  files: Array<{
    target: string
    kind: string
    orchestrator?: string
    version?: string
    sha256: string
  }>
}
const root = dirname(manifestPath)
const db = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
)
for (const file of manifest.files.filter(
  (item) =>
    item.kind === 'prompt' && isCopyBrainRuntimeOrchestrator(item.orchestrator)
)) {
  if (!file.orchestrator || !file.version) {
    throw new Error(`${file.target}: prompt metadata missing`)
  }
  const packagedPath = join(root, file.target)
  const installedPath = join(repoRoot, file.target)
  const contentPath = existsSync(packagedPath) ? packagedPath : installedPath
  const content = readFileSync(contentPath, 'utf8')
  const actualSha = createHash('sha256').update(content).digest('hex')
  if (actualSha !== file.sha256) {
    throw new Error(`${file.target}: staged prompt checksum mismatch`)
  }
  const { data: existing, error } = await db
    .from('prompts')
    .select('id,is_active')
    .eq('orchestrator_name', file.orchestrator)
    .eq('prompt_type', 'main')
    .eq('version', file.version)
    .is('vertical_id', null)
    .maybeSingle()
  if (error) throw error
  if (existing?.is_active) {
    throw new Error(
      `${file.orchestrator}/${file.version} is active; staging refuses to edit live content`
    )
  }
  const operation = existing
    ? db.from('prompts').update({ content }).eq('id', existing.id)
    : db.from('prompts').insert({
        orchestrator_name: file.orchestrator,
        prompt_type: 'main',
        version: file.version,
        vertical_id: null,
        content,
        is_active: false,
      })
  const { error: writeError } = await operation
  if (writeError) throw writeError
  console.log(`STAGED INACTIVE ${file.orchestrator}/${file.version}`)
}
