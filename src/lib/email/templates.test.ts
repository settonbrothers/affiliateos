import { describe, expect, it } from 'vitest'

import {
  agentFailureEmail,
  lowCreditsEmail,
  receiptEmail,
  welcomeEmail,
} from './templates'

describe('email templates', () => {
  it('welcome sums trial + bonus credits', () => {
    const e = welcomeEmail({ bonusCredits: 50 })
    expect(e.subject).toMatch(/welcome/i)
    expect(e.html).toContain('150 credits')
    expect(e.html).toContain('50 invite bonus')
  })

  it('welcome with no bonus shows trial only', () => {
    const e = welcomeEmail({ bonusCredits: 0 })
    expect(e.html).toContain('100 credits')
    expect(e.html).not.toContain('invite bonus')
  })

  it('receipt formats the dollar amount', () => {
    const e = receiptEmail({ credits: 30, amountCents: 2000, kind: 'credits' })
    expect(e.html).toContain('$20.00')
    expect(e.html).toContain('30 credits')
  })

  it('low credits shows the balance', () => {
    expect(lowCreditsEmail({ balance: 5 }).html).toContain('5 credits')
  })

  it('agent failure includes orchestrator + error', () => {
    const e = agentFailureEmail({ orchestrator: 'UnderwritingOrchestrator', error: 'boom' })
    expect(e.subject).toContain('UnderwritingOrchestrator')
    expect(e.html).toContain('boom')
  })
})
