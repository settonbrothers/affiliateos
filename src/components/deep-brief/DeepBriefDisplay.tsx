import { EditorialCard } from '@/components/brand/editorial/EditorialCard'
import { EditorialSlab } from '@/components/brand/editorial/EditorialSlab'
import type { DeepBriefPayload } from '@/types/agents/deepBrief'

export function DeepBriefDisplay({ payload }: { payload: unknown }) {
  const p = payload as DeepBriefPayload | null
  if (!p) {
    return (
      <p style={{ fontSize: '14px', color: '#B23A24' }}>
        Deep brief payload is malformed — re-run the generation.
      </p>
    )
  }

  const cards: [string, string][] = [
    ['What we sell', p.what_we_sell],
    ['Timing — why now?', p.timing],
    ['Emotional connection', p.emotional_connection],
    ['What normal state means', p.normal_state_meaning],
    ['Control in hands', p.control_in_hands],
    ['Real confidence', p.real_confidence],
  ]
  const crack: [string, string][] = [
    ['Problem / Pain', p.crack_post_params.problem_pain],
    ['Solution', p.crack_post_params.solution],
    ['Urgency', p.crack_post_params.urgency],
    ['Agenda / Proof', p.crack_post_params.agenda_proof],
    ['Benefit Amplified', p.crack_post_params.benefit_amplified],
    ['Belief It Will Happen', p.crack_post_params.belief_it_will_happen],
    ['CTA', p.crack_post_params.cta_placeholder],
  ]

  return (
    <div className="flex flex-col gap-5">
      {p.main_differentiator && (
        <EditorialSlab label="MAIN DIFFERENTIATOR · הבידול המרכזי">
          <p
            style={{
              margin: 0,
              fontFamily: 'var(--font-display)',
              fontSize: 'clamp(18px,2.4vw,26px)',
              fontWeight: 500,
              lineHeight: 1.25,
            }}
          >
            {p.main_differentiator}
          </p>
        </EditorialSlab>
      )}

      {p.search_summary && (
        <p style={{ fontSize: '13px', color: '#6B6459' }}>
          <span style={{ fontWeight: 600, color: '#1F1B16' }}>Research summary: </span>
          {p.search_summary}
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {cards.map(([title, val]) => (
          <EditorialCard key={title} title={title}>
            {val}
          </EditorialCard>
        ))}
      </div>

      <EditorialCard title="Must-know facts">
        <ul style={{ margin: 0, paddingInlineStart: '18px', listStyle: 'disc', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {(p.must_know ?? []).map((item, i) => (
            <li key={item + '-' + i}>{item}</li>
          ))}
        </ul>
      </EditorialCard>

      {(p.proofs ?? []).length > 0 && (
        <EditorialCard title="Proofs">
          <ul style={{ margin: 0, paddingInlineStart: '18px', listStyle: 'disc', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {(p.proofs ?? []).map((item, i) => (
              <li key={item + '-' + i}>{item}</li>
            ))}
          </ul>
        </EditorialCard>
      )}

      <EditorialCard title="Crack Post Parameters">
        <div className="grid gap-3 sm:grid-cols-2">
          {crack.map(([title, val]) => (
            <div key={title}>
              <p style={{ margin: 0, fontWeight: 600, fontSize: '13px', color: '#1F1B16' }}>{title}</p>
              <p style={{ margin: 0, fontSize: '13px', color: '#6B6459' }}>{val}</p>
            </div>
          ))}
        </div>
      </EditorialCard>
    </div>
  )
}
