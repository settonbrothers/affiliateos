type HookType =
  | 'curiosity'
  | 'pain'
  | 'social_proof'
  | 'pattern_interrupt'
  | 'data'
  | 'story'
  | 'challenge'
  | 'benefit'
  | 'fear'
  | 'authority'

type CreativeAnalysisItem = {
  hook: string
  hook_type: HookType
  what_worked: string
  what_didnt: string
  is_winner: boolean
  winner_reason?: string
}

type DiagnoseV2Data = {
  creative_analysis: CreativeAnalysisItem[]
  overall_assessment: string
  next_campaign_recommendations: string[]
  winning_hooks: string[]
}

const HOOK_TYPE_LABELS: Record<HookType, string> = {
  curiosity: 'סקרנות',
  pain: 'כאב',
  social_proof: 'הוכחה חברתית',
  pattern_interrupt: 'שבירת דפוס',
  data: 'נתונים',
  story: 'סיפור',
  challenge: 'אתגר',
  benefit: 'תועלת',
  fear: 'פחד',
  authority: 'סמכות',
}

const EmptyMark = ({ w = 16 }: { w?: number }) => (
  <span
    style={{
      display: 'inline-block',
      width: `${w}px`,
      height: '1px',
      background: '#DED8CB',
      verticalAlign: 'middle',
    }}
  />
)

export function DiagnoseV2Display({
  creativeAnalysis,
  winningHooks,
  winnersAddedToLibrary,
}: {
  creativeAnalysis: unknown
  winningHooks: unknown
  winnersAddedToLibrary?: boolean | null
}) {
  const analysis = creativeAnalysis as DiagnoseV2Data | null

  if (!analysis || !Array.isArray(analysis.creative_analysis)) {
    return (
      <p style={{ fontSize: '14px', color: '#6B6459' }}>
        אין ניתוח קריאייטיב זמין עדיין.
      </p>
    )
  }

  const hookSet = new Set(
    Array.isArray(winningHooks) ? (winningHooks as string[]) : []
  )

  return (
    <div className="flex flex-col gap-8">
      {/* Overall assessment */}
      <div
        style={{
          borderInlineStart: '3px solid var(--primary)',
          paddingInlineStart: '16px',
        }}
      >
        <p style={{ fontSize: '13.5px', lineHeight: 1.65, color: '#1F1B16' }}>
          {analysis.overall_assessment}
        </p>
      </div>

      {/* Winning hooks table */}
      <div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', marginBottom: '14px', flexWrap: 'wrap' }}>
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '10.5px',
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              color: '#8A7A55',
            }}
          >
            Hooks tested
          </span>
          {winnersAddedToLibrary && (
            <span
              dir="ltr"
              style={{
                marginInlineStart: 'auto',
                fontFamily: 'var(--font-mono)',
                fontSize: '11px',
                color: '#8A7A55',
              }}
            >
              winners added to Hook Library
            </span>
          )}
        </div>

        <div style={{ borderTop: '1px solid #DED8CB' }}>
          {analysis.creative_analysis.map((item, i) => {
            const isWin = item.is_winner || hookSet.has(item.hook)
            return (
              <div
                key={i}
                dir="rtl"
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'auto minmax(0,1fr) 140px',
                  alignItems: 'center',
                  gap: '18px',
                  padding: '16px 12px',
                  borderBottom: '1px solid #ECE6DA',
                  background: isWin ? '#FBF3D8' : 'transparent',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
                  <span
                    dir="ltr"
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '11px',
                      color: '#1F1B16',
                      border: '1px solid #DED8CB',
                      padding: '4px 8px',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  {isWin && (
                    <span
                      dir="ltr"
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: '8px',
                        color: '#0A0A0A',
                        background: 'var(--primary)',
                        padding: '2px 6px',
                      }}
                    >
                      WIN
                    </span>
                  )}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: 0 }}>
                  <span style={{ fontSize: '14px', color: isWin ? '#1F1B16' : '#6B6459' }}>
                    {item.hook}
                  </span>
                  <span
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '10.5px',
                      color: '#9A8F73',
                    }}
                  >
                    {HOOK_TYPE_LABELS[item.hook_type] ?? item.hook_type}
                  </span>
                </div>

                <div dir="ltr" style={{ display: 'flex', flexDirection: 'column', gap: '4px', textAlign: 'right' }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: '#1F7A3D' }}>
                    {item.what_worked || <EmptyMark />}
                  </span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: '#B4232A' }}>
                    {item.what_didnt || <EmptyMark />}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Next campaign recommendations */}
      {analysis.next_campaign_recommendations &&
        analysis.next_campaign_recommendations.length > 0 && (
          <div className="flex flex-col gap-3">
            <h3
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '10.5px',
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                color: '#8A7A55',
              }}
            >
              המלצות לקמפיין הבא
            </h3>
            <ol style={{ display: 'flex', flexDirection: 'column', gap: '8px', margin: 0, padding: 0, listStyle: 'none' }}>
              {analysis.next_campaign_recommendations.map((rec, i) => (
                <li key={i} style={{ display: 'flex', gap: '8px', fontSize: '13.5px', color: '#1F1B16' }}>
                  <span style={{ fontFamily: 'var(--font-mono)', color: '#9A8F73' }}>
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  {rec}
                </li>
              ))}
            </ol>
          </div>
        )}
    </div>
  )
}
