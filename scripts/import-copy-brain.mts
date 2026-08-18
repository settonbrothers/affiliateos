import { createHash } from 'node:crypto'
import { copyFileSync, mkdirSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'

const argv = process.argv.slice(2)
const packageIndex = argv.indexOf('--package')
const rawManifestPath = packageIndex >= 0 ? argv[packageIndex + 1] : null
if (!rawManifestPath) {
  throw new Error(
    'Usage: pnpm brain:import -- --package <manifest.json> [--apply]'
  )
}
const manifestPath = resolve(rawManifestPath)
const apply = argv.includes('--apply')
const repo = resolve(import.meta.dirname, '..')
const releaseRoot = dirname(manifestPath)
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as {
  release_version: string
  source_git_sha: string
  manifest_sha256: string
  files: Array<{ target: string; sha256: string; kind: string }>
}
const allowed = [
  /^prompts\/copy_/,
  /^prompts\/avatar_builder\//,
  /^brain-contracts\//,
  /^brain-evals\//,
  /^brain-release\//,
]
const sha = (path: string) =>
  createHash('sha256').update(readFileSync(path)).digest('hex')
let drift = 0

for (const file of manifest.files) {
  if (!allowed.some((pattern) => pattern.test(file.target))) {
    throw new Error(
      `Release target is outside the copy ownership allowlist: ${file.target}`
    )
  }
  const source = join(releaseRoot, file.target)
  if (sha(source) !== file.sha256) {
    throw new Error(`${file.target}: package checksum mismatch`)
  }
  const target = join(repo, file.target)
  let current: string | null = null
  try {
    current = sha(target)
  } catch {
    current = null
  }
  if (current === file.sha256) {
    console.log(`OK     ${file.target}`)
    continue
  }
  drift++
  console.log(`${apply ? 'APPLY ' : 'DRIFT '} ${file.target}`)
  if (apply) {
    mkdirSync(dirname(target), { recursive: true })
    copyFileSync(source, target)
  }
}

console.log(
  `${manifest.release_version} source=${manifest.source_git_sha} manifest=${manifest.manifest_sha256}`
)
if (drift && !apply) process.exitCode = 2
if (apply) {
  const releaseManifestTarget = join(repo, 'brain-release/manifest.json')
  mkdirSync(dirname(releaseManifestTarget), { recursive: true })
  copyFileSync(manifestPath, releaseManifestTarget)
  console.log('APPLY  brain-release/manifest.json')
}
