import type { CopyBrainInputSnapshotV1 } from '../types/copyBrain.ts'

export const COPY_BRAIN_DOCTRINE_V3 = {
  bundleVersion: 'latest-owner-doctrine-v3' as const,
  registryVersion: '2026-08-19.1',
  checksum: 'ce1470eef7b1bc818ea02f8f30822fea584ab51aa58074b0d3a25873a41cb6cc',
  activeLessonIds: [
    'L20',
    'L24',
    'L27',
    'L32',
    'L36',
    'L40',
    'L44',
    'L60',
    'L67',
    'L91_L109_L116',
    'L94',
    'L95',
    'L96_L121',
    'L97',
    'L117',
    'L118',
    'L119_L120_L122',
    'L123',
    'L124',
    'L125',
    'L126',
    'L127',
    'L128',
  ],
  supersededLessonIds: [
    'OLD_FIXED_LINE_COUNTS',
    'OLD_COMPONENT_CHECKLIST_PASS',
  ],
}

const normalized = (value: unknown) =>
  String(value ?? '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
const present = (value: unknown) =>
  typeof value === 'string' &&
  Boolean(value.trim()) &&
  !/^(unknown|לא ידוע|null)$/i.test(value.trim())
const flattenAnchors = (
  value: unknown,
  output: Array<{ anchor?: string; value?: unknown }> = []
) => {
  if (!value || typeof value !== 'object') return output
  for (const item of Object.values(value as Record<string, unknown>)) {
    if (item && typeof item === 'object' && 'anchor' in item && 'value' in item)
      output.push(item as { anchor?: string; value?: unknown })
    else flattenAnchors(item, output)
  }
  return output
}
const legacyAvatarCompleteness = (value: unknown) => {
  if (!value || typeof value !== 'object' || 'schema_version' in value) return 0
  const avatar = value as Record<string, unknown>
  const fields = [
    avatar.who,
    avatar.life_situation,
    avatar.pain_points,
    avatar.objections,
    avatar.desires,
    avatar.voice_of_customer,
    avatar.transformation,
    avatar.emotional_trigger,
    avatar.trust_signals,
  ]
  const populated = fields.filter((field) =>
    Array.isArray(field) ? field.length > 0 : present(field)
  ).length
  return Number((populated / fields.length).toFixed(3))
}
const consumerFacingBrief = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(consumerFacingBrief)
  if (!value || typeof value !== 'object') return value
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(
        ([key]) =>
          !/(explicit_non_target|internal|economics|affiliate_program)/i.test(
            key
          )
      )
      .map(([key, item]) => [key, consumerFacingBrief(item)])
  )
}

export function selectRelevantTaste(
  entries: Array<Record<string, unknown>>,
  context: {
    offerId?: string
    vertical?: string | null
    objective?: string
    audience?: string | null
  },
  limit = 4
) {
  const seen = new Set<string>()
  const excluded: Array<{ index: number; reason: string }> = []
  const eligible: Array<Record<string, unknown> & { score: number }> = []
  for (const [index, entry] of entries.entries()) {
    const text =
      entry.improved_text ?? entry.text ?? entry.copy ?? entry.content
    const kind = normalized(entry.kind ?? entry.label ?? entry.type)
    const reason = normalized(entry.reason ?? entry.lesson ?? entry.feedback)
    const fingerprint = normalized(text)
    if (!fingerprint) {
      excluded.push({ index, reason: 'empty_text' })
      continue
    }
    if (
      (kind.includes('bad') ||
        kind.includes('reject') ||
        kind.includes('fail')) &&
      !reason
    ) {
      excluded.push({ index, reason: 'negative_without_reason' })
      continue
    }
    if (seen.has(fingerprint)) {
      excluded.push({ index, reason: 'duplicate' })
      continue
    }
    seen.add(fingerprint)
    const vertical = normalized(
      entry.vertical ?? entry.vertical_id ?? entry.category
    )
    const offerId = normalized(entry.offer_id ?? entry.offerId)
    const objective = normalized(entry.objective ?? entry.campaign_objective)
    const audience = normalized(entry.audience ?? entry.segment)
    let score = 0
    if (offerId && offerId === normalized(context.offerId)) score += 10
    if (vertical && vertical === normalized(context.vertical)) score += 6
    if (objective && objective === normalized(context.objective)) score += 4
    if (audience && normalized(context.audience).includes(audience)) score += 3
    eligible.push({
      index,
      score,
      use_mode:
        vertical &&
        normalized(context.vertical) &&
        vertical !== normalized(context.vertical)
          ? 'principle_only'
          : 'voice_and_principle',
      lesson: reason || null,
      entry,
    })
  }
  eligible.sort(
    (left, right) =>
      right.score - left.score || Number(right.index) - Number(left.index)
  )
  for (const item of eligible.slice(limit))
    excluded.push({ index: Number(item.index), reason: 'lower_relevance' })
  return {
    selected: eligible.slice(0, limit),
    excluded,
    selection_policy:
      'dedupe; exclude unexplained negatives; rank offer > vertical > objective > audience; cross-vertical examples teach principles only',
  }
}

export function compileCopyExecutionBriefV2(
  snapshot: CopyBrainInputSnapshotV1
) {
  const campaign = snapshot.campaign_context
  const fields = flattenAnchors(snapshot.avatar)
  const knownFields = fields.filter(
    (field) => field.anchor !== 'unknown' && present(field.value)
  )
  const avatarCompleteness = fields.length
    ? Number((knownFields.length / fields.length).toFixed(3))
    : legacyAvatarCompleteness(snapshot.avatar)
  const avatar = snapshot.avatar as Record<string, unknown> | null
  const segment = avatar?.segment_name
  const marketPosition = avatar?.market_position as
    Record<string, unknown> | undefined
  const awareness = marketPosition?.awareness_sophistication as
    Record<string, unknown> | undefined
  const actionFields = avatar?.action_fields as
    Record<string, unknown> | undefined
  const legacyVoc = Array.isArray(avatar?.voice_of_customer)
    ? avatar.voice_of_customer.map((line) => ({
        line,
        anchor: 'category_inference',
        source: null,
      }))
    : []
  const audience = present(campaign.audience)
    ? campaign.audience
    : present(segment)
      ? String(segment)
      : null
  const objectiveType = campaign.objective_type ?? 'unknown'
  const desiredAction = campaign.desired_action ?? null
  const audienceSide = campaign.audience_side ?? 'unknown'
  const deepBriefText = JSON.stringify(
    consumerFacingBrief(snapshot.deep_brief ?? {})
  ).toLowerCase()
  const offerText =
    `${snapshot.offer.name} ${snapshot.offer.description ?? ''}`.toLowerCase()
  const affiliateHeavy =
    /(affiliate|commission|recurring income|payout|שותפים|עמלה)/.test(
      deepBriefText
    )
  const conflicts =
    affiliateHeavy &&
    audienceSide === 'consumer' &&
    !/(affiliate|partner program|תוכנית שותפים)/.test(offerText)
      ? [
          {
            code: 'affiliate_program_vs_consumer_offer',
            detail:
              'Deep brief emphasizes affiliate recruitment/economics while the execution target is a consumer.',
          },
        ]
      : []
  const criticalMissing: string[] = []
  if (objectiveType === 'unknown' || !present(desiredAction))
    criticalMissing.push('campaign_objective')
  if (!present(audience)) criticalMissing.push('consumer_audience')
  if (avatarCompleteness < 0.2) criticalMissing.push('avatar_v2')
  const readinessStatus = conflicts.length
    ? 'objective_conflict'
    : criticalMissing.includes('campaign_objective')
      ? 'needs_objective'
      : criticalMissing.includes('consumer_audience')
        ? 'needs_audience'
        : criticalMissing.includes('avatar_v2')
          ? 'needs_avatar'
          : 'ready_to_write'
  const tasteSelection = selectRelevantTaste(snapshot.taste_corpus, {
    offerId: snapshot.offer.id,
    vertical: snapshot.offer.vertical,
    objective: objectiveType,
    audience,
  })
  const verified = snapshot.sources.filter((source) => source.verified)
  return {
    schema_version: 'copy-execution-brief-v2' as const,
    brief_id: `brief:${snapshot.snapshot_id}`,
    snapshot_id: snapshot.snapshot_id,
    readiness_status: readinessStatus,
    consumer_offer: {
      offer_id: snapshot.offer.id,
      name: snapshot.offer.name,
      description: snapshot.offer.description,
      vertical: snapshot.offer.vertical,
      destination_url: snapshot.offer.website_url,
      promise_source_refs: verified.map((source) => source.source_id),
    },
    affiliate_program: {
      program_url: snapshot.offer.affiliate_program_url,
      network: snapshot.offer.network,
      vendor: snapshot.offer.vendor_name,
      internal_only: true as const,
    },
    campaign_objective: {
      objective_type: objectiveType,
      desired_action: desiredAction,
      audience_side: audienceSide,
      source:
        objectiveType === 'unknown'
          ? ('unknown' as const)
          : ('campaign_context' as const),
    },
    audience: {
      summary: audience,
      awareness:
        typeof awareness?.awareness_stage === 'string'
          ? awareness.awareness_stage
          : null,
      sophistication:
        typeof awareness?.sophistication_stage === 'number'
          ? awareness.sophistication_stage
          : null,
      avatar_completeness: avatarCompleteness,
      avatar_ref: avatar ? `avatar:${snapshot.offer.id}` : null,
      voc: Array.isArray(actionFields?.voc_lines)
        ? actionFields.voc_lines
        : legacyVoc,
      source:
        avatarCompleteness > 0
          ? 'avatar_v2'
          : present(audience)
            ? 'campaign_context'
            : 'unknown',
    },
    evidence: {
      verified_claims: verified,
      source_refs: verified.map((source) => source.source_id),
      forbidden_claims:
        snapshot.compliance &&
        Array.isArray(snapshot.compliance.forbidden_claims)
          ? snapshot.compliance.forbidden_claims
          : [],
      narrative_readiness: 'unresolved' as const,
    },
    upstream_context: {
      deep_brief: snapshot.deep_brief,
      test_kit: snapshot.test_kit,
      spy_analyses: snapshot.spy_analyses,
      market_examples: snapshot.market_examples,
      performance_winners: snapshot.performance_winners,
      omitted_context: snapshot.omitted_context,
    },
    taste_selection: tasteSelection,
    doctrine_bundle: {
      bundle_version: COPY_BRAIN_DOCTRINE_V3.bundleVersion,
      registry_version: COPY_BRAIN_DOCTRINE_V3.registryVersion,
      active_lesson_ids: COPY_BRAIN_DOCTRINE_V3.activeLessonIds,
      superseded_lesson_ids: COPY_BRAIN_DOCTRINE_V3.supersededLessonIds,
      checksum: COPY_BRAIN_DOCTRINE_V3.checksum,
    },
    internal_economics: snapshot.offer_economics,
    critical_missing: criticalMissing,
    conflicts,
    trace: {
      input_sections_consumed: [
        'offer',
        'campaign_context',
        'sources',
        'deep_brief',
        'avatar',
        'test_kit',
        'spy_analyses',
        'market_examples',
        'performance_winners',
        'taste_corpus',
        'offer_economics',
      ],
      input_sections_rejected: [],
      lesson_routes: COPY_BRAIN_DOCTRINE_V3.activeLessonIds.map((lessonId) => ({
        lesson_id: lessonId,
      })),
      warnings:
        tasteSelection.selected.length === 0
          ? ['No relevant approved taste examples were selected.']
          : [],
    },
  }
}
