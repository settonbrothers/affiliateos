import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { AnalysisNav } from './AnalysisNav'

const items = [
  { key: 'scorecard' as const, label: 'Crack Score' },
  { key: 'verdict' as const, label: 'Verdict' },
  { key: 'compliance' as const, label: 'Compliance', badge: 'Capped: watch' },
]

describe('AnalysisNav', () => {
  // The whole point: before this component, grepping src/ for `tab=verdict`
  // returned nothing. The views rendered; no link reached them.
  it('links to all three analysis views', () => {
    const html = renderToStaticMarkup(
      <AnalysisNav offerId="abc" activeTab="overview" items={items} />
    )
    expect(html).toContain('/offers/abc?tab=scorecard')
    expect(html).toContain('/offers/abc?tab=verdict')
    expect(html).toContain('/offers/abc?tab=compliance')
  })

  it('surfaces a compliance cap without making you open the tab', () => {
    const html = renderToStaticMarkup(
      <AnalysisNav offerId="abc" activeTab="overview" items={items} />
    )
    expect(html).toContain('Capped: watch')
  })

  it('renders without a badge', () => {
    expect(() =>
      renderToStaticMarkup(
        <AnalysisNav
          offerId="abc"
          activeTab="verdict"
          items={[{ key: 'verdict', label: 'Verdict' }]}
        />
      )
    ).not.toThrow()
  })
})
