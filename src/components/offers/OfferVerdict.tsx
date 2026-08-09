import {
  VERDICT_LABELS,
  type StoredUnderwritingResponse,
} from '@/types/agents/underwriting'
import { verdictTier, verdictChipStyle, verdictDotColor } from '@/lib/offers/verdict-tier'

const muted = { fontSize: '13px', color: 'var(--muted-foreground)' } as const

function Section({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <div>
      <h3
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '11px',
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          color: 'var(--muted-foreground)',
          marginBottom: '6px',
        }}
      >
        {title}
      </h3>
      {children}
    </div>
  )
}

function Bullets({ items }: { items: string[] }) {
  return (
    <ul className="list-disc pl-5 text-sm" style={{ display: 'grid', gap: '2px' }}>
      {items.map((s, i) => (
        <li key={`${s}-${i}`}>{s}</li>
      ))}
    </ul>
  )
}

const SEVERITY_COLOR: Record<string, string> = {
  low: '#A2A2A0',
  medium: '#C9C9C7',
  high: 'var(--amber-text)',
  critical: '#F87171',
}

export function OfferVerdict({
  evaluation,
}: {
  evaluation: StoredUnderwritingResponse | null
}) {
  const hasVerdict = !!(
    evaluation as { payload?: { verdict?: unknown } } | null
  )?.payload?.verdict
  if (!evaluation || !hasVerdict) {
    return (
      <p style={{ fontSize: '13px', color: 'var(--muted-foreground)' }}>
        No verdict yet. Run an analysis first.
      </p>
    )
  }

  const p = evaluation.payload
  // Every one of these is produced by the model, validated by Zod and stored —
  // and until now none of them reached the screen. warnings.* is the sharpest
  // example: the prompt REQUIRES a warning here before recommending a paid
  // channel whose rules are unknown, so the safeguard was being written and
  // then hidden from the person it was protecting.
  const warnings = Object.entries(p.warnings ?? {}).filter(
    ([, v]) => typeof v === 'string' && v.trim().length > 0
  ) as Array<[string, string]>
  const estimates = evaluation.estimates ?? []
  const risks = evaluation.risks ?? []
  const assumptions = evaluation.assumptions ?? []
  const unknowns = evaluation.unknowns ?? []
  const missingData = evaluation.missing_data ?? []

  const budget =
    p.minimum_test_budget_usd !== null || p.recommended_test_budget_usd !== null

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-3">
        {(() => {
          const tier = verdictTier(p.verdict)
          return (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '9px',
                padding: '9px 16px',
                fontSize: '14px',
                fontWeight: 700,
                ...verdictChipStyle(tier),
              }}
            >
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: verdictDotColor(tier) }} />
              {VERDICT_LABELS[p.verdict]}
            </span>
          )
        })()}
        {p.recommended_channel && (
          <span style={muted}>Channel: {p.recommended_channel}</span>
        )}
        {p.recommended_geo?.length > 0 && (
          <span style={muted}>Geo: {p.recommended_geo.join(', ')}</span>
        )}
        {typeof evaluation.confidence_score === 'number' && (
          <span style={muted}>Confidence: {evaluation.confidence_score}%</span>
        )}
      </div>

      {/* Why the verdict is what it is. The model records each hard rule it
          applied; without this the cap looks arbitrary. */}
      {p.verdict_caps_applied?.length > 0 && (
        <Section title="Why the verdict was capped">
          <Bullets items={p.verdict_caps_applied} />
        </Section>
      )}

      {warnings.length > 0 && (
        <div
          style={{
            border: '1px solid var(--amber-border)',
            background: 'var(--amber-bg)',
            color: 'var(--amber-text)',
            padding: '12px 14px',
          }}
        >
          <p style={{ fontWeight: 600, marginBottom: '6px', fontSize: '13px' }}>
            Warnings
          </p>
          <ul style={{ paddingLeft: '18px', listStyleType: 'disc', fontSize: '13px', display: 'grid', gap: '3px' }}>
            {warnings.map(([key, text]) => (
              <li key={key}>
                <span style={{ fontWeight: 600, textTransform: 'capitalize' }}>{key}:</span> {text}
              </li>
            ))}
          </ul>
        </div>
      )}

      <Section title="Why test">
        <p className="text-sm">{p.main_reason_to_test}</p>
      </Section>
      <Section title="Why avoid">
        <p className="text-sm">{p.main_reason_to_avoid}</p>
      </Section>

      {budget && (
        <Section title="Test budget">
          <p className="text-sm">
            {p.minimum_test_budget_usd !== null && (
              <>Minimum ${p.minimum_test_budget_usd}</>
            )}
            {p.minimum_test_budget_usd !== null &&
              p.recommended_test_budget_usd !== null && <> · </>}
            {p.recommended_test_budget_usd !== null && (
              <>Recommended ${p.recommended_test_budget_usd}</>
            )}
          </p>
        </Section>
      )}

      {p.kill_criteria?.length > 0 && (
        <Section title="Kill criteria">
          <Bullets items={p.kill_criteria} />
        </Section>
      )}

      {/* The mirror of kill_criteria: when to put more money in. */}
      {p.scale_criteria?.length > 0 && (
        <Section title="Scale criteria">
          <Bullets items={p.scale_criteria} />
        </Section>
      )}

      {estimates.length > 0 && (
        <Section title="Estimates">
          <ul className="text-sm" style={{ display: 'grid', gap: '4px' }}>
            {estimates.map((e, i) => (
              <li key={`${e.metric}-${i}`}>
                <span style={{ fontWeight: 600 }}>{e.metric}:</span> {e.value}{' '}
                <span style={{ ...muted, fontSize: '12px' }}>({e.basis})</span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {risks.length > 0 && (
        <Section title="Risks">
          <ul className="text-sm" style={{ display: 'grid', gap: '4px' }}>
            {risks.map((r, i) => (
              <li key={`${r.type}-${i}`}>
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '11px',
                    textTransform: 'uppercase',
                    color: SEVERITY_COLOR[r.severity] ?? '#A2A2A0',
                  }}
                >
                  {r.severity}
                </span>{' '}
                <span style={{ fontWeight: 600 }}>{r.type}</span> — {r.description}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {/* Optional-chained throughout: a payload written by an older contract is
          exactly what took the offer page down once already, and a render
          crash costs more than a missing section. */}
      {evaluation.facts?.length > 0 && (
        <Section title={`Facts considered (${evaluation.facts.length})`}>
          <ul className="space-y-1 text-sm">
            {evaluation.facts.map((f, i) => (
              <li key={`${f.statement}-${i}`} className="flex flex-wrap gap-2">
                <span className="font-medium">{f.statement}</span>
                {f.source && (
                  <span style={{ fontSize: '11px', color: 'var(--muted-foreground)' }}>
                    &quot;{f.source}&quot;
                  </span>
                )}
                {typeof f.confidence === 'number' && (
                  <span
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '11px',
                      color: 'var(--muted-foreground)',
                    }}
                  >
                    {f.confidence}%
                  </span>
                )}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {/* What the analysis is NOT sure about. The model is instructed to fill
          these; hiding them turned a hedged read into a confident-looking one. */}
      {(assumptions.length > 0 || unknowns.length > 0 || missingData.length > 0) && (
        <details
          style={{
            borderTop: '1px solid var(--color-border)',
            paddingTop: '12px',
          }}
        >
          <summary
            style={{
              cursor: 'pointer',
              fontFamily: 'var(--font-mono)',
              fontSize: '11px',
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: 'var(--muted-foreground)',
            }}
          >
            What this rests on ({assumptions.length + unknowns.length + missingData.length})
          </summary>
          <div className="mt-3 flex flex-col gap-4">
            {assumptions.length > 0 && (
              <Section title="Assumptions">
                <Bullets items={assumptions} />
              </Section>
            )}
            {unknowns.length > 0 && (
              <Section title="Unknowns">
                <Bullets items={unknowns} />
              </Section>
            )}
            {missingData.length > 0 && (
              <Section title="Missing data">
                <Bullets items={missingData} />
              </Section>
            )}
          </div>
        </details>
      )}

      {evaluation.human_review_required &&
        evaluation.human_review_reasons?.length > 0 && (
          <div
            style={{
              border: '1px solid var(--amber-border)',
              background: 'var(--amber-bg)',
              padding: '12px',
              fontSize: '13px',
              color: 'var(--amber-text)',
            }}
          >
            <p style={{ fontWeight: 500, marginBottom: '6px' }}>Human review recommended</p>
            <ul style={{ paddingLeft: '18px', listStyleType: 'disc' }}>
              {evaluation.human_review_reasons.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          </div>
        )}
    </div>
  )
}
