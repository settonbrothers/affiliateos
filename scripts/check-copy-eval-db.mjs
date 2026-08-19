const ref = process.env.PROJECT_REF
const token = process.env.SUPABASE_ACCESS_TOKEN
if (!ref || !token) {
  throw new Error('PROJECT_REF and SUPABASE_ACCESS_TOKEN are required')
}

const query = `
  select json_build_object(
    'migrations', (
      select coalesce(
        json_agg(json_build_object('version', version, 'name', name) order by version),
        '[]'::json
      )
      from supabase_migrations.schema_migrations
      where version >= '0040'
    ),
    'copy_eval_cases_exists', to_regclass('public.copy_eval_cases') is not null,
    'offer_economics_exists', to_regclass('public.offer_economics') is not null,
    'negative_spend_rows', (
      select count(*) from public.campaign_results where spend_usd < 0
    ),
    'negative_revenue_rows', (
      select count(*) from public.campaign_results where revenue_usd < 0
    ),
    'eval_job_status', (
      select coalesce(json_object_agg(status, amount), '{}'::json)
      from (
        select status, count(*) amount
        from public.copy_eval_jobs
        group by status
      ) counts
    ),
    'active_eval_jobs', (
      select coalesce(
        json_agg(
          json_build_object(
            'engine', engine,
            'status', status,
            'repetition', repetition,
            'attempt_count', attempt_count,
            'started_at', started_at,
            'lease_expires_at', lease_expires_at,
            'error_message', error_message
          ) order by created_at
        ),
        '[]'::json
      )
      from public.copy_eval_jobs
      where status <> 'queued'
    ),
    'checkpoint_jobs', (
      select coalesce(
        json_agg(
          json_build_object(
            'engine', engine,
            'status', status,
            'repetition', repetition,
            'attempt_count', attempt_count,
            'checkpoint_stage', internal_trace->'candidate_checkpoint'->>'stage',
            'candidate_latency_ms', internal_trace->>'candidate_latency_ms',
            'candidate_cost_usd', internal_trace->>'candidate_cost_usd',
            'lease_expires_at', lease_expires_at,
            'error_message', error_message
          ) order by created_at
        ),
        '[]'::json
      )
      from public.copy_eval_jobs
      where internal_trace->'candidate_checkpoint' is not null
    )
  ) as diagnostic
`

const response = await fetch(
  `https://api.supabase.com/v1/projects/${ref}/database/query/read-only`,
  {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ query }),
  }
)
const body = await response.text()
console.log(`Database migration check: HTTP ${response.status}`)
console.log(body)
if (!response.ok) process.exit(1)
