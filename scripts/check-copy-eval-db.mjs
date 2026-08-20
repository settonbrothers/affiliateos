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
    'latest_eval_usage', (
      select json_build_object(
        'run_id', latest.id,
        'recorded_cost_usd', coalesce(sum(j.cost_usd), 0),
        'completed_cost_usd', coalesce(sum(j.cost_usd) filter (where j.status = 'completed'), 0),
        'failed_checkpoint_cost_usd', coalesce(sum(j.cost_usd) filter (where j.status = 'failed'), 0),
        'input_tokens', coalesce(sum(j.tokens_input), 0),
        'output_tokens', coalesce(sum(j.tokens_output), 0),
        'by_engine', (
          select coalesce(json_object_agg(engine, engine_cost), '{}'::json)
          from (
            select engine, sum(cost_usd) engine_cost
            from public.copy_eval_jobs
            where eval_run_id = latest.id
            group by engine
          ) engine_totals
        )
      )
      from (
        select id from public.copy_eval_runs order by started_at desc limit 1
      ) latest
      left join public.copy_eval_jobs j on j.eval_run_id = latest.id
      group by latest.id
    ),
    'latest_eval_coverage', (
      select coalesce(json_agg(coverage order by coverage.external_id), '[]'::json)
      from (
        select
          c.id as case_id,
          c.external_id,
          c.domain,
          c.split,
          c.origin,
          count(*) filter (where j.engine = 'production_baseline_snapshot' and j.status = 'completed') as baseline_completed,
          count(*) filter (where j.engine = 'copy_brain_candidate' and j.status = 'completed') as candidate_completed,
          (
            select count(*)
            from generate_series(0, 2) repetition_number
            where exists (
              select 1 from public.copy_eval_jobs pair_baseline
              where pair_baseline.eval_run_id = latest.id
                and pair_baseline.case_id = c.id
                and pair_baseline.engine = 'production_baseline_snapshot'
                and pair_baseline.repetition = repetition_number
                and pair_baseline.status = 'completed'
            )
            and exists (
              select 1 from public.copy_eval_jobs pair_candidate
              where pair_candidate.eval_run_id = latest.id
                and pair_candidate.case_id = c.id
                and pair_candidate.engine = 'copy_brain_candidate'
                and pair_candidate.repetition = repetition_number
                and pair_candidate.status = 'completed'
            )
          ) as completed_pairs,
          count(*) filter (
            where j.engine = 'copy_brain_candidate'
              and j.internal_trace->'candidate_checkpoint' is not null
          ) as candidate_jobs_with_checkpoints
        from (
          select id from public.copy_eval_runs order by started_at desc limit 1
        ) latest
        join public.copy_eval_jobs j on j.eval_run_id = latest.id
        join public.copy_eval_cases c on c.id = j.case_id
        group by latest.id, c.id, c.external_id, c.domain, c.split, c.origin
      ) coverage
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
