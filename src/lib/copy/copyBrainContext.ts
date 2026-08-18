import { createHash } from 'node:crypto'

import {
  CopyBrainInputSnapshotV1Schema,
  type CopyBrainInputSnapshotV1,
  type DeepAvatarV2,
  type StoredAvatar,
} from '@/types/agents/copyBrain'

const OMIT_ORDER = [
  'taste_corpus',
  'hook_library',
  'market_examples',
  'spy_analyses',
] as const

function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => `${JSON.stringify(key)}:${stable(item)}`)
      .join(',')}}`
  }
  return JSON.stringify(value)
}

export function brainSha256(value: unknown): string {
  return createHash('sha256').update(stable(value)).digest('hex')
}

export function verifyPerformanceWinnerProvenance(
  snapshot: CopyBrainInputSnapshotV1
): string[] {
  const campaignRefs = new Set(
    snapshot.sources
      .filter(
        (source) => source.source_type === 'campaign_result' && source.verified
      )
      .map((source) => source.source_id)
  )
  return snapshot.performance_winners.flatMap((winner) => {
    if (!campaignRefs.has(winner.source_ref)) {
      return [
        `${winner.winner_id}: winner has no verified campaign_result source`,
      ]
    }
    if (Object.keys(winner.metrics).length === 0) {
      return [`${winner.winner_id}: winner has no metrics`]
    }
    return []
  })
}

export function sealCopyBrainSnapshot(
  input: Omit<CopyBrainInputSnapshotV1, 'snapshot_sha256'> & {
    snapshot_sha256?: string
  }
): CopyBrainInputSnapshotV1 {
  const unsigned = { ...input, snapshot_sha256: '0'.repeat(64) }
  const sealed = { ...unsigned, snapshot_sha256: brainSha256(unsigned) }
  return CopyBrainInputSnapshotV1Schema.parse(sealed)
}

export function compileCopyBrainContext(
  raw: CopyBrainInputSnapshotV1,
  maxChars = 45_000
): {
  context: Record<string, unknown>
  omitted: CopyBrainInputSnapshotV1['omitted_context']
} {
  const snapshot = CopyBrainInputSnapshotV1Schema.parse(raw)
  const winnerErrors = verifyPerformanceWinnerProvenance(snapshot)
  if (winnerErrors.length) throw new Error(winnerErrors.join('; '))

  const sortedSources = [...snapshot.sources].sort(
    (left, right) =>
      left.priority - right.priority ||
      left.source_id.localeCompare(right.source_id)
  )
  const summarizedDocuments = snapshot.research_documents.map((document) => ({
    id: document.id ?? null,
    url: document.url ?? null,
    doc_type: document.doc_type ?? null,
    status: document.status ?? null,
    source_reliability_score: document.source_reliability_score ?? null,
    summary:
      document.source_summary ??
      document.summary ??
      (typeof document.raw_text === 'string'
        ? document.raw_text.slice(0, 2_000)
        : null),
  }))
  const context: Record<string, unknown> = {
    snapshot_id: snapshot.snapshot_id,
    offer: snapshot.offer,
    campaign_context: snapshot.campaign_context,
    underwriting: snapshot.underwriting,
    compliance: snapshot.compliance,
    evidence_sources: sortedSources,
    research_documents: summarizedDocuments,
    deep_brief: snapshot.deep_brief,
    avatar: snapshot.avatar,
    test_kit: snapshot.test_kit,
    performance_winners: snapshot.performance_winners,
    spy_analyses: snapshot.spy_analyses,
    market_examples: snapshot.market_examples,
    taste_corpus: snapshot.taste_corpus,
    hook_library: snapshot.hook_library,
    creative_hint: snapshot.creative_hint,
    missing_inputs: snapshot.missing_inputs,
  }
  const omitted = [...snapshot.omitted_context]
  if (
    snapshot.research_documents.some(
      (document) => typeof document.raw_text === 'string'
    )
  ) {
    omitted.push({
      section: 'research_documents.raw_text',
      reason: 'secondary_document_text_summarized_by_context_compiler',
      source_refs: snapshot.research_documents
        .map((document) => String(document.id ?? ''))
        .filter(Boolean),
    })
  }
  for (const section of OMIT_ORDER) {
    if (stable(context).length <= maxChars) break
    const items = context[section]
    if (!Array.isArray(items) || items.length === 0) continue
    context[section] = []
    omitted.push({
      section,
      reason: `context_budget_${maxChars}_characters`,
      source_refs: [],
    })
  }
  if (stable(context).length > maxChars) {
    throw new Error(
      'Core verified context exceeds the budget; refusing silent truncation.'
    )
  }
  context.omitted_context = omitted
  return { context, omitted }
}

const value = (field: { value: string | null }) => field.value ?? '[לא ידוע]'

export function projectDeepAvatarV2ToLegacy(avatar: DeepAvatarV2) {
  return {
    who: value(avatar.identity.portrait),
    life_situation: value(avatar.identity.week_texture),
    pain_points: [
      value(avatar.emotion_map.fear_ladder.surface_fear),
      value(avatar.emotion_map.shame_and_hiding),
      value(avatar.belief_map.past_attempts_scars),
    ],
    objections: [
      avatar.buying_psychology.stated_vs_real_objection.stated,
      avatar.buying_psychology.stated_vs_real_objection.real,
    ],
    desires: [
      value(avatar.emotion_map.dreams.near_dream),
      value(avatar.emotion_map.dreams.deep_dream),
      value(avatar.emotion_map.dreams.identity_dream),
    ],
    voice_of_customer: avatar.action_fields.voc_lines
      .filter((line) => line.anchor === 'quote')
      .map((line) => line.line),
    transformation: value(avatar.action_fields.transformation_arc),
    emotional_trigger: value(avatar.action_fields.the_one_trigger),
    trust_signals: [
      value(avatar.market_position.consumer_trust_wounds),
      value(avatar.buying_psychology.permission_needed),
    ],
  }
}

export function upgradeStoredAvatarToV2(
  offerId: string,
  avatar: StoredAvatar
): DeepAvatarV2 {
  if ('schema_version' in avatar) return avatar
  const basis =
    'legacy-avatar-v1; retained only as category inference until re-anchored'
  const inferred = (value: string | undefined) =>
    value?.trim()
      ? { value, anchor: 'category_inference' as const, source: basis }
      : { value: null, anchor: 'unknown' as const, source: null }
  const unknown = () => ({
    value: null,
    anchor: 'unknown' as const,
    source: null,
  })
  const pain = (index: number) => inferred(avatar.pain_points[index])
  const desire = (index: number) => inferred(avatar.desires[index])
  return {
    schema_version: 'deep-avatar-v2',
    offer_id: offerId,
    segment_name: 'legacy-avatar-upgrade',
    identity: {
      portrait: inferred(avatar.who),
      week_texture: inferred(avatar.life_situation),
      identity_gap: unknown(),
    },
    emotion_map: {
      fear_ladder: {
        surface_fear: pain(0),
        deep_fear: pain(1),
        wordless_fear: pain(2),
      },
      three_am_thoughts: unknown(),
      shame_and_hiding: unknown(),
      dreams: {
        near_dream: desire(0),
        deep_dream: desire(1),
        identity_dream: desire(2),
      },
      envy_comparison: unknown(),
    },
    belief_map: {
      cause_theory: unknown(),
      who_is_blamed: unknown(),
      solution_beliefs: inferred(avatar.objections[0]),
      past_attempts_scars: inferred(avatar.objections[1]),
    },
    market_position: {
      awareness_sophistication: {
        awareness_stage: 'problem_aware',
        sophistication_stage: 1,
        entry_point_note:
          'Unknown until evidence-aware avatar excavation runs.',
        anchor: 'unknown',
      },
      already_seen: unknown(),
      consumer_trust_wounds: unknown(),
    },
    buying_psychology: {
      stated_vs_real_objection: {
        stated: avatar.objections[0] ?? '[לא ידוע]',
        real: avatar.objections[1] ?? '[לא ידוע]',
        anchor: avatar.objections.length ? 'category_inference' : 'unknown',
      },
      purchase_context: unknown(),
      internal_price_anchor: unknown(),
      permission_needed: unknown(),
      decision_moment: unknown(),
    },
    action_fields: {
      voc_lines: [],
      the_one_trigger: inferred(avatar.emotional_trigger),
      transformation_arc: inferred(avatar.transformation),
      forbidden_word: unknown(),
    },
    summary: {
      core_identity: avatar.who,
      current_state: [avatar.life_situation, ...avatar.pain_points].filter(
        Boolean
      ),
      central_problem_in_their_words: null,
      pains: avatar.pain_points,
      psychological_drivers: avatar.desires,
      desired_result: avatar.transformation,
      product_meaning: '[לא ידוע עד לחפירת אווטאר מעוגנת]',
    },
    declared_gaps: [
      'Legacy avatar had no per-field provenance.',
      'Legacy voice-of-customer lines were not promoted to quotes.',
      'Unknown deep-avatar fields require frozen evidence before copy use.',
    ],
  }
}

export function createUnknownDeepAvatarV2(
  offerId: string,
  segmentName = 'unknown-segment'
): DeepAvatarV2 {
  const unknown = () => ({
    value: null,
    anchor: 'unknown' as const,
    source: null,
  })
  return {
    schema_version: 'deep-avatar-v2',
    offer_id: offerId,
    segment_name: segmentName,
    identity: {
      portrait: unknown(),
      week_texture: unknown(),
      identity_gap: unknown(),
    },
    emotion_map: {
      fear_ladder: {
        surface_fear: unknown(),
        deep_fear: unknown(),
        wordless_fear: unknown(),
      },
      three_am_thoughts: unknown(),
      shame_and_hiding: unknown(),
      dreams: {
        near_dream: unknown(),
        deep_dream: unknown(),
        identity_dream: unknown(),
      },
      envy_comparison: unknown(),
    },
    belief_map: {
      cause_theory: unknown(),
      who_is_blamed: unknown(),
      solution_beliefs: unknown(),
      past_attempts_scars: unknown(),
    },
    market_position: {
      awareness_sophistication: {
        awareness_stage: 'problem_aware',
        sophistication_stage: 1,
        entry_point_note:
          'Unknown until evidence-aware avatar excavation runs.',
        anchor: 'unknown',
      },
      already_seen: unknown(),
      consumer_trust_wounds: unknown(),
    },
    buying_psychology: {
      stated_vs_real_objection: {
        stated: '[לא ידוע]',
        real: '[לא ידוע]',
        anchor: 'unknown',
      },
      purchase_context: unknown(),
      internal_price_anchor: unknown(),
      permission_needed: unknown(),
      decision_moment: unknown(),
    },
    action_fields: {
      voc_lines: [],
      the_one_trigger: unknown(),
      transformation_arc: unknown(),
      forbidden_word: unknown(),
    },
    summary: {
      core_identity: '[לא ידוע]',
      current_state: [],
      central_problem_in_their_words: null,
      pains: [],
      psychological_drivers: [],
      desired_result: '[לא ידוע]',
      product_meaning: '[לא ידוע]',
    },
    declared_gaps: [
      'No upstream avatar was available when this eval snapshot was sealed.',
    ],
  }
}
