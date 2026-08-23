import { readFileSync } from 'node:fs'

const ref = process.env.PROJECT_REF
const token = process.env.SUPABASE_ACCESS_TOKEN
if (!ref || !token) {
  throw new Error('PROJECT_REF and SUPABASE_ACCESS_TOKEN are required')
}

const api = `https://api.supabase.com/v1/projects/${ref}/database`

async function query(path, sql) {
  const response = await fetch(`${api}/${path}`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ query: sql }),
  })
  const body = await response.text()
  if (!response.ok) {
    throw new Error(`${path} failed with HTTP ${response.status}: ${body}`)
  }
  return body ? JSON.parse(body) : null
}

const beforeRows = await query(
  'query/read-only',
  `select json_build_object(
    'migration_exists', exists (
      select 1 from supabase_migrations.schema_migrations where version = '0048'
    ),
    'table_exists', to_regclass('public.ad_copy_jobs') is not null,
    'required_parent_migrations', (
      select coalesce(json_agg(version order by version), '[]'::json)
      from supabase_migrations.schema_migrations
      where version in ('0046', '0047')
    )
  ) as preflight`
)
const before = beforeRows?.[0]?.preflight
if (!before) throw new Error('Could not read ad-copy job migration preflight')
if (
  before.migration_exists ||
  before.table_exists ||
  JSON.stringify(before.required_parent_migrations) !==
    JSON.stringify(['0046', '0047'])
) {
  throw new Error(
    `Refusing unexpected database state: ${JSON.stringify(before)}`
  )
}

const migration = readFileSync(
  'supabase/migrations/0048_ad_copy_jobs.sql',
  'utf8'
)
await query(
  'query',
  `begin;
${migration}
insert into supabase_migrations.schema_migrations(version, statements, name)
values ('0048', array['applied atomically by ad-copy jobs deployment'], 'ad_copy_jobs');
commit;`
)

const rows = await query(
  'query/read-only',
  `select json_build_object(
    'migration_exists', exists (
      select 1 from supabase_migrations.schema_migrations where version = '0048'
    ),
    'table_exists', to_regclass('public.ad_copy_jobs') is not null
  ) as verification`
)
const verification = rows?.[0]?.verification
if (!verification?.migration_exists || !verification?.table_exists) {
  throw new Error(
    `Migration verification failed: ${JSON.stringify(verification)}`
  )
}
console.log(`Ad-copy jobs migration applied: ${JSON.stringify(verification)}`)
