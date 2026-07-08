import { EditorialCard } from '@/components/brand/editorial/EditorialCard'
import type { TestKitResponse } from '@/types/agents/testKit'

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <h3
        style={{
          margin: 0,
          fontFamily: 'var(--font-mono)',
          fontSize: '11px',
          fontWeight: 600,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: '#8A8375',
        }}
      >
        {title}
      </h3>
      {children}
    </div>
  )
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        display: 'inline-block',
        background: '#EFEBE1',
        color: '#1F1B16',
        fontSize: '12px',
        fontWeight: 500,
        padding: '3px 9px',
      }}
    >
      {children}
    </span>
  )
}

export function TestKitView({ payload }: { payload: unknown }) {
  // jsonb arrives untyped; the orchestrator validated it against the Zod
  // contract before storing, so the cast is sound.
  const env = payload as TestKitResponse | null
  const p = env?.payload
  if (!p) {
    return (
      <p style={{ fontSize: '14px', color: '#B23A24' }}>
        Test kit payload is malformed — regenerate it.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-6" style={{ color: '#1F1B16' }}>
      <Section title="Objective">
        <p style={{ fontSize: '14px' }}>{p.test_objective}</p>
      </Section>

      <div className="grid gap-3 sm:grid-cols-3">
        <EditorialCard title="Channel">
          <div className="flex flex-col gap-1">
            <div className="flex gap-2">
              <Pill>{p.channel_plan.primary}</Pill>
              {p.channel_plan.secondary && <Pill>{p.channel_plan.secondary}</Pill>}
            </div>
            <p style={{ fontSize: '12px', color: '#6B6459' }}>{p.channel_plan.reasoning}</p>
          </div>
        </EditorialCard>
        <EditorialCard title="Budget (USD)">
          <div className="flex flex-col gap-1">
            <p>
              min ${p.budget_plan.minimum_usd} · rec ${p.budget_plan.recommended_usd} · max $
              {p.budget_plan.max_initial_usd}
            </p>
            <p style={{ fontSize: '12px', color: '#6B6459' }}>{p.budget_plan.reasoning}</p>
          </div>
        </EditorialCard>
        <EditorialCard title="GEO">
          <div className="flex flex-col gap-1">
            <p>{p.geo_plan.primary.join(', ')}</p>
            {p.geo_plan.secondary && p.geo_plan.secondary.length > 0 && (
              <p style={{ fontSize: '12px', color: '#6B6459' }}>
                also: {p.geo_plan.secondary.join(', ')}
              </p>
            )}
          </div>
        </EditorialCard>
      </div>

      <Section title="Audience">
        <p style={{ fontSize: '14px' }}>{p.audience_direction}</p>
      </Section>

      <Section title={`Angles (${p.angles.length})`}>
        <div className="grid gap-3 sm:grid-cols-3">
          {p.angles.map((a, i) => (
            <EditorialCard key={a.name + '-' + i} title={`${i}. ${a.name}`}>
              <p>{a.positioning}</p>
              <p style={{ fontSize: '12px', color: '#6B6459' }}>{a.target_audience}</p>
            </EditorialCard>
          ))}
        </div>
      </Section>

      <Section title={`Hooks (${p.hooks.length})`}>
        <ul className="flex flex-col gap-1.5" style={{ fontSize: '14px' }}>
          {p.hooks.map((h, i) => (
            <li key={h.text.slice(0, 20) + '-' + i} className="flex items-baseline gap-2">
              <Pill>#{h.angle_index}</Pill>
              <span>{h.text}</span>
              <span style={{ fontSize: '12px', color: '#6B6459' }}>{h.format}</span>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Ad copy">
        <div className="grid gap-3 sm:grid-cols-3">
          {p.ad_copy_variants.map((v, i) => (
            <EditorialCard key={v.headline.slice(0, 20) + '-' + i} title={v.headline}>
              <div className="flex flex-col gap-2">
                <p>{v.body}</p>
                <Pill>{v.cta}</Pill>
              </div>
            </EditorialCard>
          ))}
        </div>
      </Section>

      <Section title="Landing page">
        <div className="flex flex-col gap-1" style={{ fontSize: '14px' }}>
          <p>
            <span style={{ fontWeight: 600 }}>Above fold:</span> {p.landing_structure.above_fold}
          </p>
          <p>
            <span style={{ fontWeight: 600 }}>Argument:</span> {p.landing_structure.main_argument}
          </p>
          <p>
            <span style={{ fontWeight: 600 }}>Proof:</span>{' '}
            {p.landing_structure.proof_elements.join(' · ')}
          </p>
          <p>
            <span style={{ fontWeight: 600 }}>CTA:</span> {p.landing_structure.cta}
          </p>
        </div>
      </Section>

      <div className="grid gap-3 sm:grid-cols-2">
        <Section title="KPI targets">
          <p style={{ fontSize: '14px' }}>
            CTR {p.kpi_targets.ctr_target}% · CPC ${p.kpi_targets.cpc_target} · CVR{' '}
            {p.kpi_targets.cvr_target}% · EPC ${p.kpi_targets.epc_target}
          </p>
          <p style={{ fontSize: '12px', color: '#6B6459' }}>
            Primary KPI: {p.tracking_plan.primary_kpi}
          </p>
        </Section>
        <Section title="Kill / scale criteria">
          <ul style={{ margin: 0, paddingInlineStart: '20px', listStyle: 'disc', fontSize: '14px' }}>
            {p.kill_criteria.map((c, i) => (
              <li key={`k${i}`} style={{ color: '#B23A24' }}>
                {c}
              </li>
            ))}
            {p.scale_criteria.map((c, i) => (
              <li key={`s${i}`} style={{ color: '#2E6B34' }}>
                {c}
              </li>
            ))}
          </ul>
        </Section>
      </div>

      {p.compliance_warnings.length > 0 && (
        <div style={{ border: '1px solid #E0C86A', background: '#FBF3D8', padding: '12px', fontSize: '14px', color: '#1F1B16' }}>
          <p style={{ margin: 0, fontWeight: 600 }}>Compliance</p>
          <ul style={{ margin: '4px 0 0', paddingInlineStart: '20px', listStyle: 'disc' }}>
            {p.compliance_warnings.map((w, i) => (
              <li key={w.slice(0, 20) + '-' + i}>{w}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
