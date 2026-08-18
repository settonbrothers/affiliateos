'use server'

import { revalidatePath } from 'next/cache'
import { createHash } from 'node:crypto'

import type { SupabaseClient } from '@supabase/supabase-js'

import protocol from '../../../brain-evals/copy-system-v2.protocol.json'
import sourcePacks from '../../../brain-evals/copy-system-v2.source-packs.json'
import releaseManifest from '../../../brain-release/manifest.json'
import {
  brainSha256,
  createUnknownDeepAvatarV2,
  sealCopyBrainSnapshot,
  upgradeStoredAvatarToV2,
} from '@/lib/copy/copyBrainContext'
import {
  selectAffxEvalOffers,
  type EvalOfferCandidate,
} from '@/lib/copy/copyEvalSelection'
import { createClient } from '@/lib/supabase/server'
import {
  CopyBrainInputSnapshotV1Schema,
  StoredAvatarSchema,
  type CopyBrainInputSnapshotV1,
} from '@/types/agents/copyBrain'

type JsonRecord = Record<string, unknown>
type Row = JsonRecord & { id: string }

const asRecord = (value: unknown): JsonRecord | null =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as JsonRecord)
    : null

async function adminDb(): Promise<SupabaseClient> {
  const typed = await createClient()
  const {
    data: { user },
  } = await typed.auth.getUser()
  if (!user) throw new Error('Not authenticated')
  const { data: profile } = await typed
    .from('profiles')
    .select('system_role')
    .eq('id', user.id)
    .single()
  if (profile?.system_role !== 'admin') throw new Error('Admin only')
  return typed as SupabaseClient
}

const latestByOffer = (rows: JsonRecord[], key = 'offer_id') => {
  const map = new Map<string, JsonRecord>()
  for (const row of rows) {
    const offerId = String(row[key] ?? '')
    if (offerId && !map.has(offerId)) map.set(offerId, row)
  }
  return map
}

const groupBy = (rows: JsonRecord[], key: string) => {
  const grouped = new Map<string, JsonRecord[]>()
  for (const row of rows) {
    const value = String(row[key] ?? '')
    if (!value) continue
    grouped.set(value, [...(grouped.get(value) ?? []), row])
  }
  return grouped
}

const shaText = (value: string) =>
  createHash('sha256').update(value).digest('hex')

function syntheticAvatar(offerId: string, name: string, vertical: string) {
  return upgradeStoredAvatarToV2(offerId, {
    who: `Synthetic fixture consumer for ${name}`,
    life_situation: `Controlled ${vertical} scenario; not a real testimonial.`,
    pain_points: [
      'A bounded category problem',
      'Skepticism after prior claims',
      'Needs credible proof',
    ],
    objections: [
      'Is the mechanism supported?',
      'Is the promised outcome exaggerated?',
    ],
    desires: ['A bounded improvement', 'A credible path', 'Less uncertainty'],
    voice_of_customer: [],
    transformation:
      'From the bounded problem to the bounded supported outcome.',
    emotional_trigger:
      'Relief without being manipulated by an unsupported promise.',
    trust_signals: ['Independent evidence', 'A precise non-guaranteed claim'],
  })
}

async function buildSyntheticSnapshot(pack: JsonRecord) {
  const offer = asRecord(pack.offer)
  if (!offer) throw new Error(`${String(pack.id)}: fixture offer missing`)
  const offerId = String(offer.id)
  const name = String(offer.name)
  const vertical = String(offer.vertical)
  const rawSources = Array.isArray(pack.sources) ? pack.sources : []
  const sources = rawSources.map((raw, index) => {
    const source = asRecord(raw) ?? {}
    const sourceId = String(source.source_id ?? `fixture-${index}`)
    const claim = String(source.claim ?? '')
    const sourceType = String(source.source_type ?? 'first_party_document') as
      | 'network_platform'
      | 'independent_research'
      | 'independent_review'
      | 'first_party_document'
      | 'operator_note'
      | 'spy_example'
      | 'campaign_result'
    return {
      source_id: sourceId,
      source_type: sourceType,
      source_url: null,
      source_quote: null,
      claim,
      priority:
        sourceType === 'network_platform'
          ? 1
          : sourceType.startsWith('independent')
            ? 2
            : sourceType === 'first_party_document'
              ? 3
              : 5,
      verified:
        sourceType !== 'operator_note' || String(pack.domain) === 'donation',
      snapshot_sha256: shaText(`${sourceId}\n${claim}`),
    }
  })
  return sealCopyBrainSnapshot({
    schema_version: 'copy-brain-input-v1',
    snapshot_id: String(pack.id),
    captured_at: new Date().toISOString(),
    origin: 'synthetic_fixture',
    fixture_only: true,
    offer: {
      id: offerId,
      name,
      website_url: null,
      affiliate_program_url: null,
      network: 'controlled-fixture',
      vendor_name: null,
      vertical,
      primary_language: 'en',
      description: 'Controlled evaluation fixture; not publishable.',
    },
    campaign_context: {
      channel: 'paid_social',
      geo: ['US'],
      audience: null,
      generation_language: 'he',
    },
    underwriting: { fixture: true, publishable: false },
    compliance: Array.isArray(pack.forbidden_claims)
      ? { forbidden_claims: pack.forbidden_claims }
      : null,
    sources,
    research_documents: rawSources as JsonRecord[],
    deep_brief: {
      fixture: true,
      note: 'Controlled source pack; infer the eligible format from evidence only.',
    },
    spy_analyses: [],
    market_examples: [],
    performance_winners: [],
    avatar: syntheticAvatar(offerId, name, vertical),
    test_kit: { channel: 'paid_social', language: 'he', fixture: true },
    taste_corpus: [],
    hook_library: [],
    creative_hint: null,
    missing_inputs: [],
    omitted_context: [],
  })
}

export async function prepareCopyEvalSuite(): Promise<{
  created: number
  selectedAffx: string[]
}> {
  const db = await adminDb()
  const { data: existing } = await db
    .from('copy_eval_cases')
    .select('external_id')
    .like('external_id', 'copy-brain-v2:%')
  if ((existing ?? []).length === 8) {
    return { created: 0, selectedAffx: [] }
  }

  const [
    offersRes,
    factsRes,
    sourceDocsRes,
    briefsRes,
    avatarsRes,
    spiesRes,
    kitsRes,
    complianceRes,
    runsRes,
    campaignsRes,
    campaignResultsRes,
    diagnosesRes,
    corpusRes,
    hookLibraryRes,
  ] = await Promise.all([
    db
      .from('offers')
      .select(
        'id,workspace_id,name,website_url,affiliate_program_url,network,vendor_name,primary_language,short_description,operator_notes,verticals(slug)'
      )
      .in('status', ['ai_analyzed', 'published']),
    db
      .from('extracted_facts')
      .select(
        'offer_id,source_document_id,fact_type,fact_value,source_quote,confidence_score'
      )
      .eq('status', 'verified'),
    db
      .from('source_documents')
      .select(
        'id,offer_id,url,doc_type,raw_text,source_summary,source_reliability_score,status'
      )
      .in('status', ['fetched', 'extracted']),
    db
      .from('offer_deep_briefs')
      .select('offer_id,payload,created_at')
      .order('created_at', { ascending: false }),
    db
      .from('offer_avatars')
      .select('offer_id,payload,created_at')
      .order('created_at', { ascending: false }),
    db
      .from('spy_analyses')
      .select('offer_id,id,payload,input_type,raw_input,created_at')
      .order('created_at', { ascending: false }),
    db
      .from('test_kits')
      .select('offer_id,payload,created_at')
      .order('created_at', { ascending: false }),
    db
      .from('offer_compliance_warnings')
      .select('offer_id,payload,overall_risk_level,created_at')
      .order('created_at', { ascending: false }),
    db
      .from('ai_runs')
      .select('offer_id,output_payload,created_at')
      .eq('orchestrator_name', 'UnderwritingOrchestrator')
      .eq('status', 'success')
      .order('created_at', { ascending: false }),
    db.from('campaigns').select('id,offer_id'),
    db
      .from('campaign_results')
      .select(
        'campaign_id,spend_usd,impressions,clicks,landing_views,conversions,revenue_usd,days_running'
      ),
    db.from('result_diagnoses').select('campaign_id,creative_analysis'),
    db
      .from('copy_taste_examples')
      .select('kind,lang,text,improved_text,label,reason,workspace_id')
      .order('created_at', { ascending: false })
      .limit(200),
    db
      .from('copy_hook_library')
      .select('text,lang,hook_type,label')
      .order('created_at', { ascending: false }),
  ])
  for (const result of [
    offersRes,
    factsRes,
    sourceDocsRes,
    briefsRes,
    avatarsRes,
    spiesRes,
    kitsRes,
    complianceRes,
    runsRes,
    campaignsRes,
    campaignResultsRes,
    diagnosesRes,
    corpusRes,
    hookLibraryRes,
  ]) {
    if (result.error) throw result.error
  }
  const offers = (offersRes.data ?? []) as Row[]
  const facts = (factsRes.data ?? []) as JsonRecord[]
  const briefs = latestByOffer((briefsRes.data ?? []) as JsonRecord[])
  const avatars = latestByOffer((avatarsRes.data ?? []) as JsonRecord[])
  const kits = latestByOffer((kitsRes.data ?? []) as JsonRecord[])
  const compliance = latestByOffer((complianceRes.data ?? []) as JsonRecord[])
  const underwriting = latestByOffer((runsRes.data ?? []) as JsonRecord[])
  const spies = (spiesRes.data ?? []) as JsonRecord[]
  const factsByOffer = groupBy(facts, 'offer_id')
  const spiesByOffer = groupBy(spies, 'offer_id')
  const documentsById = new Map(
    ((sourceDocsRes.data ?? []) as JsonRecord[]).map(
      (row) => [String(row.id), row] as const
    )
  )
  const offerByCampaign = new Map(
    ((campaignsRes.data ?? []) as JsonRecord[]).map(
      (row) => [String(row.id), String(row.offer_id)] as const
    )
  )
  const winnerCount = new Map<string, number>()
  const resultsByCampaign = new Map(
    ((campaignResultsRes.data ?? []) as JsonRecord[]).map(
      (row) => [String(row.campaign_id), row] as const
    )
  )
  const diagnosesByOffer = new Map<string, JsonRecord[]>()
  for (const diagnosis of (diagnosesRes.data ?? []) as JsonRecord[]) {
    const offerId = offerByCampaign.get(String(diagnosis.campaign_id))
    if (!offerId) continue
    const analysis = Array.isArray(diagnosis.creative_analysis)
      ? diagnosis.creative_analysis
      : []
    const count = analysis.filter(
      (item) => asRecord(item)?.is_winner === true
    ).length
    if (resultsByCampaign.has(String(diagnosis.campaign_id))) {
      winnerCount.set(offerId, (winnerCount.get(offerId) ?? 0) + count)
    }
    diagnosesByOffer.set(offerId, [
      ...(diagnosesByOffer.get(offerId) ?? []),
      diagnosis,
    ])
  }
  const candidates: EvalOfferCandidate[] = offers.map((offer) => {
    const verticalJoin = asRecord(offer.verticals)
    const offerId = String(offer.id)
    return {
      offerId,
      name: String(offer.name),
      vertical: String(verticalJoin?.slug ?? 'unknown'),
      verifiedSourceCount: (factsByOffer.get(offerId) ?? []).length,
      hasUnderwriting: underwriting.has(offerId),
      hasDeepBrief: briefs.has(offerId),
      hasAvatar: avatars.has(offerId),
      hasSpy: (spiesByOffer.get(offerId) ?? []).length > 0,
      hasTestKit: kits.has(offerId),
      measuredWinnerCount: winnerCount.get(offerId) ?? 0,
      complianceRisk: ['high', 'critical'].includes(
        String(compliance.get(offerId)?.overall_risk_level ?? '')
      ),
    }
  })
  const selected = selectAffxEvalOffers(candidates)
  const affxPacks = (sourcePacks.packs as JsonRecord[]).filter(
    (pack) => pack.origin === 'affx'
  )
  const syntheticPacks = (sourcePacks.packs as JsonRecord[]).filter(
    (pack) => pack.origin === 'synthetic_fixture'
  )
  const cases: Array<{
    pack: JsonRecord
    snapshot: CopyBrainInputSnapshotV1
    profile: string | null
    score: number | null
  }> = []
  for (const [index, selection] of selected.entries()) {
    const offer = offers.find((row) => row.id === selection.offerId)
    const pack =
      affxPacks.find(
        (item) => asRecord(item.selector)?.profile === selection.profile
      ) ?? affxPacks[index]
    if (!offer || !pack) throw new Error('AffX selector mapping failed')
    const offerFacts = factsByOffer.get(selection.offerId) ?? []
    const sources: CopyBrainInputSnapshotV1['sources'] = offerFacts.map(
      (fact, factIndex) => {
        const document = documentsById.get(
          String(fact.source_document_id ?? '')
        )
        const docType = String(document?.doc_type ?? 'unknown')
        const sourceType =
          docType === 'review_page'
            ? ('independent_review' as const)
            : docType === 'manual_note'
              ? ('operator_note' as const)
              : ('first_party_document' as const)
        return {
          source_id: `fact-${selection.offerId}-${factIndex}`,
          source_type: sourceType,
          source_url: typeof document?.url === 'string' ? document.url : null,
          source_quote:
            typeof fact.source_quote === 'string' ? fact.source_quote : null,
          claim: String(fact.fact_value),
          priority:
            sourceType === 'independent_review'
              ? 2
              : sourceType === 'first_party_document'
                ? 3
                : 5,
          verified: true,
          snapshot_sha256: shaText(JSON.stringify({ fact, document })),
        }
      }
    )
    const performanceWinners: CopyBrainInputSnapshotV1['performance_winners'] =
      []
    for (const diagnosis of diagnosesByOffer.get(selection.offerId) ?? []) {
      const campaignId = String(diagnosis.campaign_id)
      const result = resultsByCampaign.get(campaignId)
      if (!result) continue
      const metrics = {
        spend_usd: Number(result.spend_usd ?? 0),
        impressions: Number(result.impressions ?? 0),
        clicks: Number(result.clicks ?? 0),
        conversions: Number(result.conversions ?? 0),
        revenue_usd: Number(result.revenue_usd ?? 0),
      }
      const sourceRef = `campaign-${campaignId}`
      sources.push({
        source_id: sourceRef,
        source_type: 'campaign_result',
        source_url: null,
        source_quote: null,
        claim: `Measured campaign result for ${campaignId}`,
        priority: 1,
        verified: true,
        snapshot_sha256: shaText(JSON.stringify({ campaignId, metrics })),
      })
      const analysis = Array.isArray(diagnosis.creative_analysis)
        ? diagnosis.creative_analysis
        : []
      for (const [winnerIndex, item] of analysis.entries()) {
        const winner = asRecord(item)
        if (winner?.is_winner !== true || typeof winner.hook !== 'string')
          continue
        performanceWinners.push({
          winner_id: `${campaignId}-${winnerIndex}`,
          offer_id: selection.offerId,
          campaign_id: campaignId,
          creative_id: null,
          hook: winner.hook,
          metrics,
          decision_rule:
            typeof winner.winner_reason === 'string'
              ? winner.winner_reason
              : 'Diagnosis winner backed by measured campaign results.',
          source_ref: sourceRef,
        })
      }
    }
    const storedAvatar = StoredAvatarSchema.safeParse(
      avatars.get(selection.offerId)?.payload
    )
    const avatar = storedAvatar.success
      ? upgradeStoredAvatarToV2(selection.offerId, storedAvatar.data)
      : createUnknownDeepAvatarV2(selection.offerId)
    const snapshot = sealCopyBrainSnapshot({
      schema_version: 'copy-brain-input-v1',
      snapshot_id: String(pack.id),
      captured_at: new Date().toISOString(),
      origin: 'affx',
      fixture_only: false,
      offer: {
        id: selection.offerId,
        name: selection.name,
        website_url:
          typeof offer.website_url === 'string' ? offer.website_url : null,
        affiliate_program_url:
          typeof offer.affiliate_program_url === 'string'
            ? offer.affiliate_program_url
            : null,
        network: typeof offer.network === 'string' ? offer.network : null,
        vendor_name:
          typeof offer.vendor_name === 'string' ? offer.vendor_name : null,
        vertical: selection.vertical,
        primary_language:
          typeof offer.primary_language === 'string'
            ? offer.primary_language
            : null,
        description:
          typeof offer.short_description === 'string'
            ? offer.short_description
            : typeof offer.operator_notes === 'string'
              ? offer.operator_notes
              : null,
      },
      campaign_context: {
        channel: 'paid_social',
        geo: [],
        audience: null,
        generation_language: 'he',
      },
      underwriting: asRecord(
        underwriting.get(selection.offerId)?.output_payload
      ),
      compliance: asRecord(compliance.get(selection.offerId)?.payload),
      sources,
      research_documents: ((sourceDocsRes.data ?? []) as JsonRecord[]).filter(
        (document) => document.offer_id === selection.offerId
      ),
      deep_brief: asRecord(briefs.get(selection.offerId)?.payload),
      spy_analyses: spiesByOffer.get(selection.offerId) ?? [],
      market_examples: spiesByOffer.get(selection.offerId) ?? [],
      performance_winners: performanceWinners,
      avatar,
      test_kit: asRecord(kits.get(selection.offerId)?.payload),
      taste_corpus: ((corpusRes.data ?? []) as JsonRecord[])
        .filter(
          (row) =>
            row.workspace_id === null || row.workspace_id === offer.workspace_id
        )
        .slice(0, 60),
      hook_library: (hookLibraryRes.data ?? []) as JsonRecord[],
      creative_hint: null,
      missing_inputs: [
        !storedAvatar.success ? 'upstream_avatar' : null,
        !briefs.has(selection.offerId) ? 'deep_brief' : null,
        !spiesByOffer.get(selection.offerId)?.length ? 'spy_analyses' : null,
        !kits.has(selection.offerId) ? 'test_kit' : null,
      ].filter((item): item is string => item !== null),
      omitted_context: [],
    })
    cases.push({
      pack,
      snapshot,
      profile: selection.profile,
      score: selection.completenessScore,
    })
  }
  for (const pack of syntheticPacks) {
    cases.push({
      pack,
      snapshot: await buildSyntheticSnapshot(pack),
      profile: null,
      score: null,
    })
  }
  const rows = cases.map(({ pack, snapshot, profile, score }) => ({
    external_id: `copy-brain-v2:${String(pack.id)}`,
    domain: pack.domain === 'donation' ? 'donation' : 'product',
    split: String(pack.split),
    source_pack: pack,
    input_snapshot: snapshot,
    origin: snapshot.origin,
    fixture_only: snapshot.fixture_only,
    selection_profile: profile,
    completeness_score: score,
    sealed_sha256: snapshot.snapshot_sha256,
    sealed_at: new Date().toISOString(),
  }))
  const { error: insertError } = await db.from('copy_eval_cases').insert(rows)
  if (insertError) throw insertError
  revalidatePath('/admin/eval/copy')
  return {
    created: rows.length,
    selectedAffx: selected.map((item) => `${item.name} (${item.profile})`),
  }
}

export async function startCopyEvalRun(): Promise<{ runId: string }> {
  const db = await adminDb()
  const { data: cases, error: caseError } = await db
    .from('copy_eval_cases')
    .select('id,external_id,input_snapshot,sealed_sha256')
    .like('external_id', 'copy-brain-v2:%')
    .order('external_id')
  if (caseError) throw caseError
  if ((cases ?? []).length !== 8)
    throw new Error('Prepare exactly eight sealed cases first')
  const baselineOrchestrators = [
    'CopyExcavateProductOrchestrator',
    'CopyExcavateAvatarOrchestrator',
    'CopyAngleOrchestrator',
    'CopyHookOrchestrator',
    'CopyWriteOrchestrator',
    'CopyJudgeOrchestrator',
  ]
  const candidateFiles = releaseManifest.files.filter(
    (file) => file.kind === 'prompt' && file.orchestrator && file.version
  )
  const candidateOrchestrators = candidateFiles.map((file) =>
    String(file.orchestrator)
  )
  const allOrchestrators = [
    ...new Set([...baselineOrchestrators, ...candidateOrchestrators]),
  ]
  const { data: activePrompts, error: promptError } = await db
    .from('prompts')
    .select('orchestrator_name,version,content,vertical_id,verticals(slug)')
    .eq('is_active', true)
    .in('orchestrator_name', baselineOrchestrators)
    .order('orchestrator_name')
  if (promptError) throw promptError
  const { data: stagedPrompts, error: stagedError } = await db
    .from('prompts')
    .select('orchestrator_name,version,content,is_active,vertical_id')
    .in('orchestrator_name', allOrchestrators)
    .eq('prompt_type', 'main')
  if (stagedError) throw stagedError
  const candidatePrompts = candidateFiles.map((file) => {
    const row = (stagedPrompts ?? []).find(
      (prompt) =>
        prompt.orchestrator_name === file.orchestrator &&
        prompt.version === file.version &&
        prompt.vertical_id === null
    )
    if (!row)
      throw new Error(
        `Stage candidate prompt first: ${file.orchestrator}/${file.version}`
      )
    if (shaText(String(row.content)) !== file.sha256)
      throw new Error(
        `Staged prompt checksum drift: ${file.orchestrator}/${file.version}`
      )
    return {
      orchestrator_name: file.orchestrator,
      version: file.version,
      content: String(row.content),
      content_sha256: file.sha256,
      is_active: row.is_active,
    }
  })
  const baselinePromptsByCase = Object.fromEntries(
    (cases ?? []).map((evalCase) => {
      const snapshot = CopyBrainInputSnapshotV1Schema.parse(
        evalCase.input_snapshot
      )
      const versions = baselineOrchestrators.map((orchestratorName) => {
        const matches = (activePrompts ?? []).filter(
          (prompt) => prompt.orchestrator_name === orchestratorName
        )
        const vertical = matches.find((prompt) => {
          const join = asRecord(prompt.verticals)
          return join?.slug === snapshot.offer.vertical
        })
        const global = matches.find((prompt) => prompt.vertical_id === null)
        const resolved = vertical ?? global
        if (!resolved)
          throw new Error(
            `No active baseline prompt for ${orchestratorName} / ${snapshot.offer.vertical ?? 'global'}`
          )
        return {
          orchestrator_name: orchestratorName,
          version: resolved.version,
          content: String(resolved.content),
          content_sha256: shaText(String(resolved.content)),
        }
      })
      return [String(evalCase.id), versions]
    })
  )
  const baselineManifest = brainSha256(baselinePromptsByCase)
  const { data: run, error: runError } = await db
    .from('copy_eval_runs')
    .insert({
      protocol_version: protocol.protocol,
      engine_version: releaseManifest.engine_version,
      baseline_version: baselineManifest,
      prompt_manifest_sha256: releaseManifest.manifest_sha256,
      model_id: 'claude-sonnet-4-6',
      repetitions_per_engine: 3,
      case_count: 8,
      status: 'running',
      metrics: {
        baseline_prompts_by_case: baselinePromptsByCase,
        candidate_prompts: candidatePrompts,
        blind_order_seed: protocol.blind_order_seed,
        model_parameters: {
          max_tokens: 4096,
          max_retries: 3,
          temperature: 'provider_default',
        },
      },
      details: [],
    })
    .select('id')
    .single()
  if (runError) throw runError
  const jobs = (cases ?? []).flatMap((evalCase) =>
    ['production_baseline_snapshot', 'copy_brain_candidate'].flatMap((engine) =>
      [0, 1, 2].map((repetition) => ({
        eval_run_id: run.id,
        case_id: evalCase.id,
        engine,
        repetition,
        status: 'queued',
        input_snapshot_sha256: evalCase.sealed_sha256,
        prompt_manifest_sha256:
          engine === 'copy_brain_candidate'
            ? releaseManifest.manifest_sha256
            : baselineManifest,
      }))
    )
  )
  const { error: jobError } = await db.from('copy_eval_jobs').insert(jobs)
  if (jobError) throw jobError
  revalidatePath('/admin/eval/copy')
  return { runId: String(run.id) }
}

async function finalizeCopyEvalRun(db: SupabaseClient, evalRunId: string) {
  const [
    { data: ownerScores },
    { data: jobs },
    { data: evalCases },
    { data: evalRun },
  ] = await Promise.all([
    db.from('copy_eval_owner_scores').select('*').eq('eval_run_id', evalRunId),
    db
      .from('copy_eval_jobs')
      .select(
        'id,case_id,engine,repetition,mode_decision,truth_violation,judge_publishable,cost_usd'
      )
      .eq('eval_run_id', evalRunId)
      .eq('status', 'completed'),
    db
      .from('copy_eval_cases')
      .select('id,split')
      .like('external_id', 'copy-brain-v2:%'),
    db.from('copy_eval_runs').select('metrics').eq('id', evalRunId).single(),
  ])
  if ((ownerScores ?? []).length !== 8 || (jobs ?? []).length !== 48) return
  let wins = 0
  let losses = 0
  let totalDelta = 0
  let dimensionCount = 0
  let judgeOwnerMatches = 0
  let falsePasses = 0
  let holdoutFalsePasses = 0
  for (const score of ownerScores ?? []) {
    const candidate = (jobs ?? []).find(
      (job) =>
        job.case_id === score.case_id &&
        job.engine === 'copy_brain_candidate' &&
        job.repetition === score.presented_repetition
    )
    if (!candidate)
      throw new Error(
        `Presented candidate job missing for case ${score.case_id}`
      )
    const candidateSide =
      score.blind_left_id === candidate.id
        ? 'left'
        : score.blind_right_id === candidate.id
          ? 'right'
          : null
    if (!candidateSide)
      throw new Error(
        `Blind pair does not contain candidate for case ${score.case_id}`
      )
    if (score.preference !== 'tie') {
      if (score.preference === candidateSide) wins++
      else losses++
    }
    const values = asRecord(score.scores) ?? {}
    for (const dimension of [
      'scroll_stop',
      'curiosity',
      'emotional_peak',
      'tangible_need',
      'causal_solution',
      'credibility',
      'power',
      'publishability',
    ]) {
      const candidateScore = Number(values[`${candidateSide}_${dimension}`])
      const baselineScore = Number(
        values[`${candidateSide === 'left' ? 'right' : 'left'}_${dimension}`]
      )
      if (Number.isFinite(candidateScore) && Number.isFinite(baselineScore)) {
        totalDelta += candidateScore - baselineScore
        dimensionCount++
      }
    }
    const ownerPublishable =
      candidateSide === 'left'
        ? score.publishability_left
        : score.publishability_right
    const ownerTruthReject =
      candidateSide === 'left'
        ? score.truth_reject_left
        : score.truth_reject_right
    const ownerCausalityReject =
      candidateSide === 'left'
        ? score.causality_reject_left
        : score.causality_reject_right
    if (candidate.judge_publishable === ownerPublishable) judgeOwnerMatches++
    if (
      candidate.judge_publishable &&
      (ownerTruthReject || ownerCausalityReject)
    ) {
      falsePasses++
      if (
        (evalCases ?? []).find((item) => item.id === score.case_id)?.split ===
        'holdout'
      )
        holdoutFalsePasses++
    }
  }
  const candidateJobs = (jobs ?? []).filter(
    (job) => job.engine === 'copy_brain_candidate'
  )
  const stableModeCases = (evalCases ?? []).filter((evalCase) => {
    const modes = new Set(
      candidateJobs
        .filter((job) => job.case_id === evalCase.id)
        .map((job) => job.mode_decision)
    )
    return modes.size === 1
  }).length
  const truthViolations = candidateJobs.filter(
    (job) => job.truth_violation
  ).length
  const averageScoreDelta = dimensionCount ? totalDelta / dimensionCount : 0
  const acceptance = protocol.acceptance
  const passed =
    wins >= acceptance.candidate_min_wins &&
    losses <= acceptance.candidate_max_losses &&
    averageScoreDelta >= acceptance.min_average_score_delta &&
    truthViolations === acceptance.candidate_truth_violations &&
    stableModeCases >= acceptance.stable_mode_cases_min &&
    judgeOwnerMatches >= acceptance.judge_owner_case_matches_min &&
    falsePasses === acceptance.judge_false_pass_on_truth_or_causality &&
    holdoutFalsePasses === acceptance.holdout_kill_false_pass
  const totalCost = (jobs ?? []).reduce(
    (sum, job) => sum + Number(job.cost_usd ?? 0),
    0
  )
  const metrics = {
    ...(asRecord(evalRun?.metrics) ?? {}),
    wins,
    losses,
    ties: 8 - wins - losses,
    average_score_delta: averageScoreDelta,
    truth_violations: truthViolations,
    stable_mode_cases: stableModeCases,
    judge_owner_matches: judgeOwnerMatches,
    false_passes: falsePasses,
    holdout_false_passes: holdoutFalsePasses,
    acceptance,
  }
  const { error } = await db
    .from('copy_eval_runs')
    .update({
      status: passed ? 'passed' : 'failed',
      metrics,
      details: metrics,
      total_cost_usd: totalCost,
      completed_at: new Date().toISOString(),
    })
    .eq('id', evalRunId)
  if (error) throw error
}

export async function submitCopyOwnerScore(input: {
  evalRunId: string
  caseId: string
  leftId: string
  rightId: string
  scores: Record<string, unknown>
  preference: 'left' | 'right' | 'tie'
  publishabilityLeft: boolean
  publishabilityRight: boolean
  truthRejectLeft: boolean
  truthRejectRight: boolean
  causalityRejectLeft: boolean
  causalityRejectRight: boolean
  presentedRepetition: number
  feedback: string
}) {
  const db = await adminDb()
  const {
    data: { user },
  } = await db.auth.getUser()
  if (!user) throw new Error('Not authenticated')
  const { error } = await db.from('copy_eval_owner_scores').upsert(
    {
      eval_run_id: input.evalRunId,
      case_id: input.caseId,
      blind_left_id: input.leftId,
      blind_right_id: input.rightId,
      presented_repetition: input.presentedRepetition,
      scores: input.scores,
      preference: input.preference,
      publishability_left: input.publishabilityLeft,
      publishability_right: input.publishabilityRight,
      truth_reject_left: input.truthRejectLeft,
      truth_reject_right: input.truthRejectRight,
      causality_reject_left: input.causalityRejectLeft,
      causality_reject_right: input.causalityRejectRight,
      freeform_feedback: input.feedback.trim() || null,
      scored_by: user.id,
      scored_at: new Date().toISOString(),
    },
    { onConflict: 'eval_run_id,case_id' }
  )
  if (error) throw error
  const { data: calibrationCases } = await db
    .from('copy_eval_cases')
    .select('id')
    .eq('split', 'calibration')
    .like('external_id', 'copy-brain-v2:%')
  const calibrationIds = (calibrationCases ?? []).map((item) => item.id)
  if (calibrationIds.length === 6) {
    const { count } = await db
      .from('copy_eval_owner_scores')
      .select('id', { count: 'exact', head: true })
      .eq('eval_run_id', input.evalRunId)
      .in('case_id', calibrationIds)
    if (count === 6) {
      await db
        .from('copy_eval_cases')
        .update({ revealed_at: new Date().toISOString() })
        .eq('split', 'holdout')
        .like('external_id', 'copy-brain-v2:%')
      await db
        .from('copy_eval_runs')
        .update({ status: 'awaiting_owner' })
        .eq('id', input.evalRunId)
    }
  }
  const { count: totalScores } = await db
    .from('copy_eval_owner_scores')
    .select('id', { count: 'exact', head: true })
    .eq('eval_run_id', input.evalRunId)
  if (totalScores === 8) await finalizeCopyEvalRun(db, input.evalRunId)
  revalidatePath(`/admin/eval/copy/${input.evalRunId}`)
}

export async function retryFailedCopyEvalJobs(evalRunId: string) {
  const db = await adminDb()
  const { error } = await db
    .from('copy_eval_jobs')
    .update({
      status: 'queued',
      error_message: null,
      completed_at: null,
      lease_expires_at: null,
    })
    .eq('eval_run_id', evalRunId)
    .eq('status', 'failed')
  if (error) throw error
  await db
    .from('copy_eval_runs')
    .update({ status: 'running' })
    .eq('id', evalRunId)
  revalidatePath(`/admin/eval/copy/${evalRunId}`)
}
