import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const manifest = JSON.parse(
  readFileSync(join(root, 'brain-release/manifest.json'), 'utf8')
) as {
  release_version: string
  files: Array<{ target: string; sha256: string }>
}
const sha = (path: string) =>
  createHash('sha256').update(readFileSync(path)).digest('hex')
const drift = manifest.files.filter(
  (file) => sha(join(root, file.target)) !== file.sha256
)
if (drift.length) {
  throw new Error(
    `Generated copy-brain drift detected in: ${drift.map((file) => file.target).join(', ')}`
  )
}
console.log(
  `PASS ${manifest.release_version}: ${manifest.files.length} generated targets match the signed release`
)
