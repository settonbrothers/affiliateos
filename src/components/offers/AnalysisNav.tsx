import Link from 'next/link'

export type AnalysisTab = 'scorecard' | 'verdict' | 'compliance'

type Item = { key: AnalysisTab; label: string; badge?: string | null }

/**
 * Navigation for the analysis layer: Crack Score, Verdict, Compliance.
 *
 * These three views have existed and rendered for months with no link to them
 * anywhere in the app — grep `tab=verdict` across src/ and you get nothing. The
 * 8-step pipeline stepper replaced the old tab bar and they fell out of it,
 * reachable only by hand-editing the URL. They are not pipeline stages (you do
 * not "complete" a verdict), so they belong beside the Crack Score, not inside
 * the wizard.
 */
export function AnalysisNav({
  offerId,
  activeTab,
  items,
}: {
  offerId: string
  activeTab: string
  items: Item[]
}) {
  return (
    <nav
      style={{
        display: 'flex',
        alignItems: 'stretch',
        gap: 'clamp(16px,2vw,28px)',
        borderTop: '1px solid rgba(255,255,255,0.12)',
        marginTop: '4px',
        paddingTop: '2px',
        overflowX: 'auto',
      }}
    >
      {items.map((item) => {
        const active = activeTab === item.key
        return (
          <Link
            key={item.key}
            href={`/offers/${offerId}?tab=${item.key}`}
            style={{
              position: 'relative',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '13px 0',
              whiteSpace: 'nowrap',
              fontFamily: 'var(--font-mono)',
              fontSize: '11px',
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              textDecoration: 'none',
              color: active ? 'var(--primary)' : '#A2A2A0',
            }}
          >
            {item.label}
            {item.badge && (
              <span
                style={{
                  fontFamily: 'var(--font-sans)',
                  fontSize: '10px',
                  letterSpacing: 0,
                  textTransform: 'none',
                  padding: '2px 7px',
                  border: '1px solid var(--amber-border)',
                  background: 'var(--amber-bg)',
                  color: 'var(--amber-text)',
                }}
              >
                {item.badge}
              </span>
            )}
            {active && (
              <span
                style={{
                  position: 'absolute',
                  insetInline: 0,
                  top: '-1px',
                  height: '2px',
                  background: 'var(--primary)',
                }}
              />
            )}
          </Link>
        )
      })}
    </nav>
  )
}
