import {
  VERDICT_LABELS,
  type UnderwritingResponse,
} from '@/types/agents/underwriting'
import { verdictTier, verdictChipStyle, verdictDotColor } from '@/lib/offers/verdict-tier'

export function OfferVerdict({
  evaluation,
}: {
  evaluation: UnderwritingResponse | null
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

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
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
          <span style={{ fontSize: '13px', color: 'var(--muted-foreground)' }}>
            Channel: {p.recommended_channel}
          </span>
        )}
      </div>

      <div>
        <h3 className="text-sm font-medium">Why test</h3>
        <p className="text-sm">{p.main_reason_to_test}</p>
      </div>
      <div>
        <h3 className="text-sm font-medium">Why avoid</h3>
        <p className="text-sm">{p.main_reason_to_avoid}</p>
      </div>

      {p.recommended_test_budget_usd !== null && (
        <div className="text-sm">
          Recommended test budget: ${p.recommended_test_budget_usd}
        </div>
      )}

      {p.kill_criteria.length > 0 && (
        <div>
          <h3 className="text-sm font-medium">Kill criteria</h3>
          <ul className="list-disc pl-5 text-sm">
            {p.kill_criteria.map((criterion) => (
              <li key={criterion}>{criterion}</li>
            ))}
          </ul>
        </div>
      )}

      {evaluation.facts.length > 0 && (
        <div>
          <h3 className="text-sm font-medium">
            Facts considered ({evaluation.facts.length})
          </h3>
          <ul className="mt-1 space-y-1 text-sm">
            {evaluation.facts.map((f, i) => (
              <li key={`${f.statement}-${i}`} className="flex gap-2">
                <span className="font-medium">{f.statement}</span>
                {f.source && (
                  <span style={{ fontSize: '11px', color: 'var(--muted-foreground)' }}>
                    — &quot;{f.source}&quot;
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {evaluation.human_review_required &&
        evaluation.human_review_reasons.length > 0 && (
          <div
            style={{
              borderRadius: '0',
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
