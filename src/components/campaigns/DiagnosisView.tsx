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
      <p style={{ fontSize: '14px', color: '#E08585' }}>
        Diagnosis payload is malformed. Re-run it.
      </p>
    )
  }

  const metrics = Object.entries(p.metric_analysis) as Array<
    [string, { actual: number; expected: [number, number]; verdict: string }]
  >

  return (
    <div style={{ background: '#F4F1EB', border: '1px solid #D8D2C6', borderTop: '3px solid var(--primary)' }}>
      <div style={{ padding: 'clamp(24px,3vw,40px)', color: '#2A2620' }}>
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
        </div>

        <div style={{ marginTop: '16px', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '11px',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              color: '#F4F1EB',
              background: '#1A1714',
              padding: '5px 11px',
            }}
          >
            bottleneck: {p.primary_bottleneck}
          </span>
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '11px',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              color: '#F4F1EB',
              background: '#1A1714',
              padding: '5px 11px',
            }}
          >
            action: {p.recommended_action}
          </span>
          {p.not_enough_data && (
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '11px',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                color: '#6B6459',
                background: '#E4DECF',
                padding: '5px 11px',
              }}
            >
              not enough data
            </span>
          )}
        </div>

        <p style={{ marginTop: '18px', fontFamily: 'var(--font-sans)', fontSize: '14px', lineHeight: 1.7, color: '#2A2620' }}>
          {p.diagnosis_summary}
        </p>

        <div style={{ marginTop: '24px' }}>
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
                    borderBottom: '1px solid #D8D2C6',
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
                    borderBottom: '1px solid #D8D2C6',
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
                    borderBottom: '1px solid #D8D2C6',
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
                    borderBottom: '1px solid #D8D2C6',
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
                  <td style={{ padding: '8px 8px 8px 0', borderBottom: '1px solid #E8E2D6', color: '#2A2620' }}>
                    {METRIC_LABELS[key] ?? key}
                  </td>
                  <td
                    style={{
                      padding: '8px',
                      borderBottom: '1px solid #E8E2D6',
                      color: '#2A2620',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {mtr.actual}
                  </td>
                  <td
                    style={{
                      padding: '8px',
                      borderBottom: '1px solid #E8E2D6',
                      color: '#6B6459',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {mtr.expected?.[0] ?? '?'}{'–'}{mtr.expected?.[1] ?? '?'}
                  </td>
                  <td
                    style={{
                      padding: '8px 0 8px 8px',
                      borderBottom: '1px solid #E8E2D6',
                      color: VERDICT_COLOR[mtr.verdict] ?? '#2A2620',
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
          <div style={{ marginTop: '24px' }}>
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
                  <span style={{ fontWeight: 700, color: '#1A1714' }}>{rec.area}:</span>{' '}
                  <span style={{ color: '#2A2620' }}>{rec.action}</span>
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
    </div>
  )
}
