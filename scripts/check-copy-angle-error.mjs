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
        'created_at', created_at,
        'tool_name', context ->> 'toolName',
        'raw_input_shape', context -> 'rawInputShape',
        'failed_usage', context -> 'failedUsage',
        'failed_cost_usd', context -> 'failedCostUsd'
      ) as angle_error
      from public.error_logs
      where source = 'anthropic:callWithTool'
        and context ->> 'toolName' = 'submit_angles'
      order by created_at desc
      limit 1`,
    }),
  }
)

const body = await response.text()
if (!response.ok) {
  throw new Error(`Angle error check failed: ${response.status} ${body}`)
}

const angleError = JSON.parse(body)?.[0]?.angle_error
if (!angleError?.raw_input_shape) {
  throw new Error('No submit_angles validation error with a raw input shape was found')
}

// Intentionally print only the structural description saved by the runtime.
// The generated copy and source material never leave the database through this check.
console.log(JSON.stringify(angleError))
