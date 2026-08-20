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

const preflightSql = `
  select json_build_object(
    'versions', (
      select coalesce(json_agg(version order by version), '[]'::json)
      from supabase_migrations.schema_migrations
      where version in ('0046', '0047')
    ),
    'copy_eval_cases_exists', to_regclass('public.copy_eval_cases') is not null,
    'offer_economics_exists', to_regclass('public.offer_economics') is not null,
    'negative_spend_rows', (
      select count(*) from public.campaign_results where spend_usd < 0
    ),
    'negative_revenue_rows', (
      select count(*) from public.campaign_results where revenue_usd < 0
    )
  ) as preflight
`

const beforeRows = await query('query/read-only', preflightSql)
const before = beforeRows?.[0]?.preflight
if (!before) throw new Error('Could not read migration preflight')
if (
  before.versions.length !== 0 ||
  before.copy_eval_cases_exists ||
  before.offer_economics_exists ||
  Number(before.negative_spend_rows) !== 0 ||
  Number(before.negative_revenue_rows) !== 0
) {
  throw new Error(`Refusing unexpected database state: ${JSON.stringify(before)}`)
}

const migration46 = readFileSync(
  'supabase/migrations/0046_copy_evidence_story_v4.sql',
  'utf8'
)
const migration47 = readFileSync(
  'supabase/migrations/0047_campaign_economics_agency.sql',
  'utf8'
)

const transaction = `
begin;
${migration46}
insert into supabase_migrations.schema_migrations(version, statements, name)
values ('0046', array['applied atomically by copy eval deployment'], 'copy_evidence_story_v4');
${migration47}
insert into supabase_migrations.schema_migrations(version, statements, name)
values ('0047', array['applied atomically by copy eval deployment'], 'campaign_economics_agency');
commit;
`

await query('query', transaction)

const verificationRows = await query(
  'query/read-only',
  `select json_build_object(
    'versions', (
      select json_agg(version order by version)
      from supabase_migrations.schema_migrations
      where version in ('0046', '0047')
    ),
    'copy_eval_cases_exists', to_regclass('public.copy_eval_cases') is not null,
    'offer_economics_exists', to_regclass('public.offer_economics') is not null
  ) as verification`
)
const verification = verificationRows?.[0]?.verification
if (
  JSON.stringify(verification?.versions) !== JSON.stringify(['0046', '0047']) ||
  !verification?.copy_eval_cases_exists ||
  !verification?.offer_economics_exists
) {
  throw new Error(`Migration verification failed: ${JSON.stringify(verification)}`)
}

console.log(`Copy eval database migrations applied: ${JSON.stringify(verification)}`)
