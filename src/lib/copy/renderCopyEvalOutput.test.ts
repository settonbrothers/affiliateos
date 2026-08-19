import { describe, expect, it } from 'vitest'

import { renderCopyEvalOutput } from './renderCopyEvalOutput'

const output = (variant: Record<string, unknown> | null) => ({
  payload: {
    output_status: variant ? 'ready_for_user' : 'blocked',
    user_message: 'הכתיבה נעצרה בגלל קלט חסר.',
    variants: variant ? [variant] : [],
  },
})

describe('renderCopyEvalOutput', () => {
  it('does not prepend a hook that already opens the body', () => {
    const rendered = renderCopyEvalOutput(
      output({
        lang: 'he',
        hook: 'זו שורת ההוק.',
        primary_text: 'זו שורת ההוק.\n\nמכאן מתחיל הגוף.',
        headline: 'כותרת',
      })
    )
    expect(rendered.reviewable).toBe(true)
    expect(rendered.text.match(/זו שורת ההוק\./g)).toHaveLength(1)
  })

  it('prepends a separate hook exactly once', () => {
    const rendered = renderCopyEvalOutput(
      output({
        lang: 'he',
        hook: 'הוק נפרד',
        primary_text: 'גוף המודעה',
        headline: 'כותרת',
      })
    )
    expect(rendered.text).toBe('הוק נפרד\n\nגוף המודעה\n\nכותרת')
  })

  it('marks a blocked result as diagnostic rather than reviewable copy', () => {
    expect(renderCopyEvalOutput(output(null))).toEqual({
      reviewable: false,
      text: 'הכתיבה נעצרה בגלל קלט חסר.',
      reason: 'blocked',
    })
  })
})
