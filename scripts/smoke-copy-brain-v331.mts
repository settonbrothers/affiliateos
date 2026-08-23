import { writeFileSync } from 'node:fs'

import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !serviceRole) {
  throw new Error('Supabase admin environment is required')
}

const admin = createClient(url, serviceRole, {
  auth: { persistSession: false },
})
const brainRelease = JSON.parse(
  await (
    await import('node:fs/promises')
  ).readFile('brain-release/manifest.json', 'utf8')
) as { release_version: string; manifest_sha256: string }
const fixture = JSON.parse(
  await (
    await import('node:fs/promises')
  ).readFile('brain-evals/leadecho-controlled-v1.snapshot.json', 'utf8')
) as {
  offer: Record<string, unknown>
  sources: Array<{
    source_id: string
    source_type: string
    source_quote: string | null
    claim: string
  }>
  deep_brief: Record<string, unknown>
  avatar: Record<string, unknown>
  test_kit: Record<string, unknown>
}

const stamp = Date.now()
const email = `copy-smoke-${stamp}@affx.test`
const password = `Copy-Smoke-${stamp}!`
let userId: string | null = null
let workspaceId: string | null = null
let offerId: string | null = null
let runId: string | null = null
let cleanupSafe = true
let smokeResult: Record<string, unknown> = {
  release: brainRelease.release_version,
  manifest_sha256: brainRelease.manifest_sha256,
  fixture: 'leadecho-controlled-v1',
  started_at: new Date().toISOString(),
}

const requireData = <T,>(data: T | null, error: unknown, label: string): T => {
  if (error || data === null) {
    throw new Error(`${label}: ${JSON.stringify(error)}`)
  }
  return data
}

try {
  const { data: created, error: createError } =
    await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })
  userId = requireData(created.user, createError, 'create smoke user').id
  await admin.from('profiles').update({ system_role: 'admin' }).eq('id', userId)

  for (let attempt = 0; attempt < 20 && !workspaceId; attempt += 1) {
    const { data } = await admin
      .from('workspace_members')
      .select('workspace_id')
      .eq('user_id', userId)
      .maybeSingle()
    workspaceId = data?.workspace_id ?? null
    if (!workspaceId) await new Promise((resolve) => setTimeout(resolve, 250))
  }
  if (!workspaceId) throw new Error('smoke workspace was not provisioned')

  const { data: vertical, error: verticalError } = await admin
    .from('verticals')
    .select('id')
    .limit(1)
    .single()
  const verticalId = requireData(vertical, verticalError, 'load vertical').id

  const { data: offer, error: offerError } = await admin
    .from('offers')
    .insert({
      workspace_id: workspaceId,
      created_by_user_id: userId,
      visibility: 'admin_only',
      status: 'ready_for_analysis',
      vertical_id: verticalId,
      name: `LeadEcho Smoke ${stamp}`,
      slug: `leadecho-smoke-${stamp}`,
      website_url: fixture.offer.website_url,
      vendor_name: fixture.offer.vendor_name,
      short_description: fixture.offer.description,
      operator_notes:
        'Controlled fixture smoke only. Sell a free 14-day product trial to English-speaking appointment-business owners.',
      primary_language: 'en',
    })
    .select('id')
    .single()
  offerId = requireData(offer, offerError, 'create smoke offer').id

  for (const source of fixture.sources) {
    const docType =
      source.source_type === 'independent_review'
        ? 'review_page'
        : source.source_type === 'first_party_document'
          ? 'product_page'
          : 'manual_note'
    const { data: doc, error: docError } = await admin
      .from('source_documents')
      .insert({
        offer_id: offerId,
        doc_type: docType,
        status: 'extracted',
        raw_text: `${source.claim}\n${source.source_quote ?? ''}`,
        language: 'en',
        source_summary: source.claim,
        source_reliability_score: 90,
      })
      .select('id')
      .single()
    const documentId = requireData(doc, docError, 'create source').id
    const { error: factError } = await admin.from('extracted_facts').insert({
      offer_id: offerId,
      source_document_id: documentId,
      fact_type: 'other',
      fact_value: source.claim,
      source_quote: source.source_quote,
      confidence_score: 100,
      status: 'verified',
      reviewed_by: userId,
      reviewed_at: new Date().toISOString(),
    })
    if (factError) throw factError
  }

  const upstreamRows = [
    admin.from('offer_deep_briefs').insert({
      offer_id: offerId,
      workspace_id: workspaceId,
      payload: fixture.deep_brief,
    }),
    admin.from('offer_avatars').insert({
      offer_id: offerId,
      workspace_id: workspaceId,
      payload: fixture.avatar,
    }),
    admin.from('test_kits').insert({
      offer_id: offerId,
      workspace_id: workspaceId,
      created_by_user_id: userId,
      payload: fixture.test_kit,
    }),
  ]
  for (const operation of upstreamRows) {
    const { error } = await operation
    if (error) throw error
  }

  const sessionClient = createClient(url, serviceRole, {
    auth: { persistSession: false },
  })
  const { data: signedIn, error: signInError } =
    await sessionClient.auth.signInWithPassword({ email, password })
  const accessToken = requireData(
    signedIn.session,
    signInError,
    'sign in smoke user'
  ).access_token

  const response = await fetch(`${url}/functions/v1/generate-ad-copy`, {
    method: 'POST',
    headers: {
      apikey: serviceRole,
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      offer_id: offerId,
      creative_hint:
        'Use the documented Maya salon case and sell the free 14-day product trial. Write directly in natural American English.',
      campaign_context: {
        channel: 'meta_facebook',
        geo: 'US',
        audience:
          'Owner-operators of appointment businesses who cannot answer while serving a customer',
        objective_type: 'trial',
        desired_action:
          'Start a free 14-day LeadEcho trial on one existing business line',
        audience_side: 'consumer',
      },
      model_profile: 'economy_smoke',
    }),
  })
  const accepted = (await response.json()) as {
    run_id?: string
    error?: string
  }
  if (!response.ok || !accepted.run_id) {
    throw new Error(
      `generate-ad-copy rejected smoke: ${response.status} ${accepted.error ?? ''}`
    )
  }
  runId = accepted.run_id
  cleanupSafe = false

  let run: Record<string, unknown> | null = null
  for (let attempt = 0; attempt < 450; attempt += 1) {
    const { data, error } = await admin
      .from('ai_runs')
      .select(
        'status,error_message,output_payload,envelope,estimated_cost,tokens_input,tokens_output,model,input_payload'
      )
      .eq('id', runId)
      .single()
    if (error) throw error
    run = data as Record<string, unknown>
    if (['success', 'failed', 'partial'].includes(String(run.status))) {
      cleanupSafe = true
      break
    }
    await new Promise((resolve) => setTimeout(resolve, 4_000))
  }
  if (!run || run.status !== 'success') {
    throw new Error(`smoke run did not succeed: ${JSON.stringify(run)}`)
  }

  const output = run.output_payload as {
    payload?: {
      engine_version?: string
      output_status?: string
      variants?: Array<{
        hook?: string
        primary_text?: string
        headline?: string
      }>
      angles?: Array<Record<string, unknown>>
      hooks?: Array<Record<string, unknown>>
      reader_report?: Record<string, unknown> | null
      critic_report?: Record<string, unknown> | null
      judge?: Record<string, unknown> | null
      trace?: Record<string, unknown>
    }
  }
  const payload = output.payload
  smokeResult = {
    ...smokeResult,
    run_id: runId,
    engine_version: payload?.engine_version ?? null,
    output_status: payload?.output_status ?? null,
    model: run.model,
    estimated_cost_usd: Number(run.estimated_cost ?? 0),
    tokens_input: run.tokens_input,
    tokens_output: run.tokens_output,
    trace: payload?.trace ?? null,
    angles: payload?.angles ?? [],
    hooks: payload?.hooks ?? [],
    reader_report: payload?.reader_report ?? null,
    critic_report: payload?.critic_report ?? null,
    judge: payload?.judge ?? null,
    candidates: payload?.variants ?? [],
  }
  if (payload?.engine_version !== 'evidence-agency-v9') {
    throw new Error(
      `unexpected engine: ${payload?.engine_version ?? 'missing'}`
    )
  }
  const variants = payload.variants ?? []
  if (variants.length === 0)
    throw new Error('smoke produced no copy candidates')
  const rendered = variants
    .flatMap((variant) => [
      variant.hook,
      variant.headline,
      variant.primary_text,
    ])
    .filter(Boolean)
    .join('\n')
  if (/[֐-׿]/u.test(rendered)) {
    throw new Error('English delivery smoke produced Hebrew copy')
  }
  if (/[—–]/u.test(rendered)) {
    throw new Error('smoke output contains a forbidden long or medium dash')
  }
  if (Number(run.estimated_cost ?? 0) <= 0) {
    throw new Error('real Opus/Sonnet smoke cost was recorded as zero')
  }

  smokeResult = {
    ...smokeResult,
    completed_at: new Date().toISOString(),
    status: 'passed',
    run_id: runId,
    engine_version: payload.engine_version,
    output_status: payload.output_status,
    candidate_count: variants.length,
    model: run.model,
    estimated_cost_usd: Number(run.estimated_cost),
    tokens_input: run.tokens_input,
    tokens_output: run.tokens_output,
    trace: payload.trace ?? null,
    candidates: variants,
  }
  writeFileSync(
    'copy-brain-v331-smoke-result.json',
    `${JSON.stringify(smokeResult, null, 2)}\n`
  )
  console.log(
    `PASS ${payload.engine_version} ${payload.output_status} candidates=${variants.length} cost=$${Number(run.estimated_cost).toFixed(4)}`
  )
} catch (error) {
  smokeResult = {
    ...smokeResult,
    completed_at: new Date().toISOString(),
    status: 'failed',
    run_id: runId,
    error: error instanceof Error ? error.message : String(error),
  }
  writeFileSync(
    'copy-brain-v331-smoke-result.json',
    `${JSON.stringify(smokeResult, null, 2)}\n`
  )
  throw error
} finally {
  if (!cleanupSafe) {
    console.warn(
      `Smoke cleanup skipped because ai_run ${runId ?? 'unknown'} is still active; fixture preserved.`
    )
  }
  if (cleanupSafe && offerId) {
    await admin.from('copy_source_snapshots').delete().eq('offer_id', offerId)
    await admin.from('ad_copy_generations').delete().eq('offer_id', offerId)
    await admin.from('ai_runs').delete().eq('offer_id', offerId)
    await admin.from('test_kits').delete().eq('offer_id', offerId)
    await admin.from('offer_avatars').delete().eq('offer_id', offerId)
    await admin.from('offer_deep_briefs').delete().eq('offer_id', offerId)
    await admin.from('extracted_facts').delete().eq('offer_id', offerId)
    await admin.from('source_documents').delete().eq('offer_id', offerId)
    await admin.from('offers').delete().eq('id', offerId)
  }
  if (cleanupSafe && workspaceId) {
    await admin.from('credit_ledger').delete().eq('workspace_id', workspaceId)
    await admin
      .from('workspace_credit_caps')
      .delete()
      .eq('workspace_id', workspaceId)
    await admin
      .from('workspace_members')
      .delete()
      .eq('workspace_id', workspaceId)
    await admin.from('workspaces').delete().eq('id', workspaceId)
  }
  if (cleanupSafe && userId) await admin.auth.admin.deleteUser(userId)
}
