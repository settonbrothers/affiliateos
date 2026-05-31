import { getAdminClient } from './supabaseAdmin.ts'

// Loads the currently-active prompt for an orchestrator from the prompts table.
// Vertical-specific row wins if both a global and vertical row are active.
// Throws if no active prompt exists — callers (orchestrators) fall back to mock
// when ANTHROPIC_API_KEY is unset, so this only fires in real-call mode after a
// misconfiguration.
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
    .maybeSingle()

  if (data?.content) return data.content

  throw new Error(
    `No active prompt found for ${orchestratorName}${verticalSlug ? ` (vertical=${verticalSlug})` : ''}.`
  )
}
