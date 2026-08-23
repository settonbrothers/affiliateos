const ref = process.env.PROJECT_REF
const token = process.env.SUPABASE_ACCESS_TOKEN
if (!ref || !token) {
  throw new Error('PROJECT_REF and SUPABASE_ACCESS_TOKEN are required')
}

const response = await fetch(
  `https://api.supabase.com/v1/projects/${ref}/database/query/read-only`,
  {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      query: `select json_build_object(
        'migration_exists', exists (
          select 1 from supabase_migrations.schema_migrations where version = '0048'
        ),
        'table_exists', to_regclass('public.ad_copy_jobs') is not null,
        'columns', (
          select json_agg(column_name order by ordinal_position)
          from information_schema.columns
          where table_schema = 'public' and table_name = 'ad_copy_jobs'
        )
      ) as verification`,
    }),
  }
)
const body = await response.text()
if (!response.ok) throw new Error(`DB check failed: ${response.status} ${body}`)
const verification = JSON.parse(body)?.[0]?.verification
if (!verification?.migration_exists || !verification?.table_exists) {
  throw new Error(
    `Ad-copy jobs DB is incomplete: ${JSON.stringify(verification)}`
  )
}
console.log(`Ad-copy jobs database ready: ${JSON.stringify(verification)}`)
