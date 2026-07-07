import type { DiagnosisResponse } from '@/types/agents/diagnosis'

const VERDICT_COLOR: Record<string, string> = {
  below: '#B4232A',
  within: '#1F7A3D',
  above: '#B07A1E',
}

const METRIC_LABELS: Record<string, string> = {
  ctr: 'CTR %',
  cpc: 'CPC $',
  clickout_rate: 'Clickout %',
  cvr: 'CVR %',
  epc: 'EPC $',
}

export function DiagnosisView({ payload }: { payload: unknown }) {
  const env = payload as DiagnosisResponse | null
  const p = env?.payload
  if (!p) {
    return (
      <p style={{ fontSize: '14px', color: '#B4232A' }}>
        Diagnosis payload is malformed. Re-run it.
      </p>
    )
  }

  const metrics = Object.entries(p.metric_analysis) as Array<
    [string, { actual: number; expected: [number, number]; verdict: string }]
  >

  return (
    <div style={{ color: '#1F1B16' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
        <span
          dir="ltr"
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '10px',
            letterSpacing: '0.14em',
            color: '#8A7A55',
          }}
        >
          AI DIAGNOSIS · אבחון
        </span>
        {typeof env?.confidence_score === 'number' && (
          <span
            dir="ltr"
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '10px',
              letterSpacing: '0.1em',
              color: '#9A8F73',
            }}
          >
            confidence {env.confidence_score}% · {env.orchestrator_name}
          </span>
        )}
      </div>

      {/* Prominent dark verdict callout */}
      <div
        style={{
          marginTop: '18px',
          background: '#141110',
          padding: '20px 24px',
        }}
      >
        <span
          style={{
            display: 'inline-block',
            fontFamily: 'var(--font-mono)',
            fontSize: '11px',
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            color: 'var(--primary)',
          }}
        >
          bottleneck · {p.primary_bottleneck}
        </span>
        <h3
          style={{
            margin: '10px 0 0',
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(28px,4vw,42px)',
            fontWeight: 600,
            lineHeight: 1.05,
            textTransform: 'uppercase',
            color: '#FFFFFF',
          }}
        >
          {p.recommended_action}
        </h3>
        {p.not_enough_data && (
          <span
            style={{
              display: 'inline-block',
              marginTop: '12px',
              fontFamily: 'var(--font-mono)',
              fontSize: '10.5px',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              color: '#9A8F73',
              border: '1px solid rgba(255,255,255,0.16)',
              padding: '4px 9px',
            }}
          >
            not enough data
          </span>
        )}
      </div>

      <p style={{ marginTop: '20px', fontFamily: 'var(--font-sans)', fontSize: '14px', lineHeight: 1.7, color: '#1F1B16' }}>
        {p.diagnosis_summary}
      </p>

      <div style={{ marginTop: '28px' }}>
        <h3
          style={{
            marginBottom: '10px',
            fontFamily: 'var(--font-mono)',
            fontSize: '10.5px',
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            color: '#8A7A55',
          }}
        >
          Metrics vs expected
        </h3>
        <table style={{ width: '100%', fontSize: '13.5px', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th
                style={{
                  textAlign: 'left',
                  padding: '6px 8px 6px 0',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '10px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  color: '#8A7A55',
                  borderBottom: '1px solid #DED8CB',
                  fontWeight: 500,
                }}
              >
                Metric
              </th>
              <th
                style={{
                  textAlign: 'left',
                  padding: '6px 8px',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '10px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  color: '#8A7A55',
                  borderBottom: '1px solid #DED8CB',
                  fontWeight: 500,
                }}
              >
                Actual
              </th>
              <th
                style={{
                  textAlign: 'left',
                  padding: '6px 8px',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '10px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  color: '#8A7A55',
                  borderBottom: '1px solid #DED8CB',
                  fontWeight: 500,
                }}
              >
                Expected
              </th>
              <th
                style={{
                  textAlign: 'left',
                  padding: '6px 0 6px 8px',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '10px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  color: '#8A7A55',
                  borderBottom: '1px solid #DED8CB',
                  fontWeight: 500,
                }}
              >
                Read
              </th>
            </tr>
          </thead>
          <tbody>
            {metrics.map(([key, mtr]) => (
              <tr key={key}>
                <td style={{ padding: '8px 8px 8px 0', borderBottom: '1px solid #ECE6DA', color: '#1F1B16' }}>
                  {METRIC_LABELS[key] ?? key}
                </td>
                <td
                  style={{
                    padding: '8px',
                    borderBottom: '1px solid #ECE6DA',
                    color: '#1F1B16',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {mtr.actual}
                </td>
                <td
                  style={{
                    padding: '8px',
                    borderBottom: '1px solid #ECE6DA',
                    color: '#6B6459',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {mtr.expected?.[0] ?? '?'}{'–'}{mtr.expected?.[1] ?? '?'}
                </td>
                <td
                  style={{
                    padding: '8px 0 8px 8px',
                    borderBottom: '1px solid #ECE6DA',
                    color: VERDICT_COLOR[mtr.verdict] ?? '#1F1B16',
                    fontWeight: 600,
                  }}
                >
                  {mtr.verdict}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {p.specific_recommendations.length > 0 && (
        <div style={{ marginTop: '28px' }}>
          <h3
            style={{
              marginBottom: '10px',
              fontFamily: 'var(--font-mono)',
              fontSize: '10.5px',
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              color: '#8A7A55',
            }}
          >
            Recommendations
          </h3>
          <ul style={{ display: 'flex', flexDirection: 'column', gap: '10px', margin: 0, padding: 0, listStyle: 'none' }}>
            {p.specific_recommendations.map((rec, i) => (
              <li key={i} style={{ fontSize: '13.5px' }}>
                <span style={{ fontWeight: 700, color: '#1F1B16' }}>{rec.area}:</span>{' '}
                <span style={{ color: '#1F1B16' }}>{rec.action}</span>
                <span style={{ display: 'block', fontSize: '12px', color: '#6B6459', marginTop: '2px' }}>
                  {rec.reasoning}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {p.not_enough_data && p.not_enough_data_reason && (
        <div
          style={{
            marginTop: '24px',
            background: '#FBF3D8',
            border: '1px solid #E4C878',
            color: '#7A5E12',
            padding: '12px',
            fontSize: '13.5px',
          }}
        >
          {p.not_enough_data_reason}
        </div>
      )}
    </div>
  )
}
