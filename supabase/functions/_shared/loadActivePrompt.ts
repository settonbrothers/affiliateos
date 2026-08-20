import { getAdminClient } from './supabaseAdmin.ts'

// Loads the currently-active prompt for an orchestrator from the prompts table.
// Vertical-specific row wins if both a global and vertical row are active.
// Throws if no active prompt exists — callers (orchestrators) fall back to mock
// when ANTHROPIC_API_KEY is unset, so this only fires in real-call mode after a
// misconfiguration.
//
// Both lookups take the newest of however many rows match rather than demanding
// exactly one. Migration 0044 makes duplicate active rows impossible, but this
// used to be a plain .maybeSingle(): two active rows made it ERROR, which took
// DiagnosisV2 and DiscoveryNetwork down entirely. A prompt loader should never
// be the thing that breaks an orchestrator.
export async function loadActivePrompt(
  orchestratorName: string,
  verticalSlug?: string
): Promise<string> {
  const admin = getAdminClient()

  let verticalId: string | null = null
  if (verticalSlug) {
    const { data: v } = await admin
      .from('verticals')
      .select('id')
      .eq('slug', verticalSlug)
      .maybeSingle()
    verticalId = v?.id ?? null
  }

  if (verticalId) {
    const { data } = await admin
      .from('prompts')
      .select('content')
      .eq('orchestrator_name', orchestratorName)
      .eq('prompt_type', 'main')
      .eq('is_active', true)
      .eq('vertical_id', verticalId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (data?.content) return data.content
  }

  const { data } = await admin
    .from('prompts')
    .select('content')
    .eq('orchestrator_name', orchestratorName)
    .eq('prompt_type', 'main')
    .eq('is_active', true)
    .is('vertical_id', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (data?.content) return data.content

  throw new Error(
    `No active prompt found for ${orchestratorName}${verticalSlug ? ` (vertical=${verticalSlug})` : ''}.`
  )
}

// Eval and staged-release runs must resolve the exact frozen version recorded
// in their manifest, even when that version is intentionally inactive.
export async function loadPromptVersion(
  orchestratorName: string,
  version: string,
  verticalSlug?: string
): Promise<string> {
  const admin = getAdminClient()
  let verticalId: string | null = null
  if (verticalSlug) {
    const { data: vertical } = await admin
      .from('verticals')
      .select('id')
      .eq('slug', verticalSlug)
      .maybeSingle()
    verticalId = vertical?.id ?? null
  }

  if (verticalId) {
    const { data } = await admin
      .from('prompts')
      .select('content')
      .eq('orchestrator_name', orchestratorName)
      .eq('prompt_type', 'main')
      .eq('version', version)
      .eq('vertical_id', verticalId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (data?.content) return data.content
  }

  const { data } = await admin
    .from('prompts')
    .select('content')
    .eq('orchestrator_name', orchestratorName)
    .eq('prompt_type', 'main')
    .eq('version', version)
    .is('vertical_id', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (data?.content) return data.content

  throw new Error(
    `No prompt version ${version} found for ${orchestratorName}${verticalSlug ? ` (vertical=${verticalSlug})` : ''}.`
  )
}
