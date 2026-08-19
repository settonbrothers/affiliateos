const ref = process.env.PROJECT_REF
const token = process.env.SUPABASE_ACCESS_TOKEN
if (!ref || !token) {
  throw new Error('PROJECT_REF and SUPABASE_ACCESS_TOKEN are required')
}

const now = new Date()
const start = new Date(now.getTime() - 30 * 60_000)
const params = new URLSearchParams({
  sql: `select timestamp as occurred_at, source, severity_text, event_message
        from logs
        where source in ('function_logs', 'function_edge_logs')
          and event_message != ''
        order by timestamp desc
        limit 200`,
  iso_timestamp_start: start.toISOString(),
  iso_timestamp_end: now.toISOString(),
})
const response = await fetch(
  `https://api.supabase.com/v1/projects/${ref}/analytics/endpoints/logs.all?${params}`,
  {
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    },
  }
)
const body = await response.text()
console.log(`Copy eval edge log check: HTTP ${response.status}`)
console.log(body)
if (!response.ok) process.exit(1)
