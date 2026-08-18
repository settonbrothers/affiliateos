import { execFileSync } from 'node:child_process'

const protectedPrefixes = [
  'supabase/functions/discover-offers/',
  'supabase/functions/analyze-offer/',
  'supabase/functions/generate-deep-brief/',
  'supabase/functions/analyze-spy/',
  'supabase/functions/_shared/orchestrators/discovery',
  'supabase/functions/_shared/orchestrators/underwriting',
  'supabase/functions/_shared/orchestrators/deepBrief',
  'src/lib/discovery/',
]

let base = 'origin/main'
try {
  execFileSync('git', ['rev-parse', '--verify', base], { stdio: 'ignore' })
} catch {
  base = 'main'
}
const changed = execFileSync('git', ['diff', '--name-only', `${base}...HEAD`], {
  encoding: 'utf8',
})
  .trim()
  .split('\n')
  .filter(Boolean)
const violations = changed.filter((path) =>
  protectedPrefixes.some((prefix) => path.startsWith(prefix))
)
if (violations.length) {
  throw new Error(
    `Copy integration touched Isaac-owned upstream paths: ${violations.join(', ')}`
  )
}
console.log(
  `PASS copy path ownership: ${changed.length} changed paths avoid protected upstream modules`
)
