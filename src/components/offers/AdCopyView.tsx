import { getTranslations } from 'next-intl/server'

import { AdCopyEditor } from '@/components/offers/AdCopyEditor'
import { HooksList } from '@/components/offers/HooksList'
import { HookSelectorPanel } from '@/components/offers/HookSelectorPanel'
import type { AdCopyResponse } from '@/types/agents/adCopy'

function Pill({
  children,
  tone = 'neutral',
}: {
  children: React.ReactNode
  tone?: 'neutral' | 'ok' | 'bad'
}) {
  const c =
    tone === 'ok'
      ? { bg: '#DCF0DC', fg: '#2E6B34' }
      : tone === 'bad'
        ? { bg: '#F6D9D2', fg: '#B23A24' }
        : { bg: '#EFEBE1', fg: '#1F1B16' }
  return (
    <span style={{ display: 'inline-block', background: c.bg, color: c.fg, fontSize: '12px', fontWeight: 500, padding: '3px 9px' }}>
      {children}
    </span>
  )
}

const cardStyle: React.CSSProperties = { background: '#FFFFFF', border: '1px solid #DED8CB', padding: '16px 18px' }
const cardTitleStyle: React.CSSProperties = { margin: 0, fontFamily: 'var(--font-display)', fontSize: '18px', fontWeight: 600, color: '#1F1B16' }

export async function AdCopyView({
  payload,
  generationId,
  initialSelectedIndices,
}: {
  payload: unknown
  generationId: string
  initialSelectedIndices: number[] | null
}) {
  const t = await getTranslations('offers')
  // jsonb arrives untyped; the orchestrator validated it against the Zod
  // contract before storing, so the cast is sound.
  const env = payload as AdCopyResponse | null
  const p = env?.payload
  if (!p) {
    return <p style={{ fontSize: '14px', color: '#B23A24' }}>{t('copyMalformed')}</p>
  }

  return (
    <div className="flex flex-col gap-6" style={{ color: '#1F1B16' }}>
      {/* Judge — advisory until calibrated against the human Taste Corpus. */}
      <div style={cardStyle}>
        <div className="flex items-center gap-2" style={{ marginBottom: '12px' }}>
          <h3 style={cardTitleStyle}>{t('copyJudgeTitle')}</h3>
          <Pill tone={p.judge.calibrated ? 'ok' : 'neutral'}>
            {p.judge.calibrated ? t('copyJudgeCalibrated') : t('copyJudgeAdvisory')}
          </Pill>
        </div>
        <div className="flex flex-col gap-2">
          {p.judge.principles.map((pr) => (
            <div key={pr.principle} className="flex items-start gap-2" style={{ fontSize: '14px' }}>
              <Pill tone={pr.verdict === 'pass' ? 'ok' : 'bad'}>{pr.verdict}</Pill>
              <span style={{ fontWeight: 500 }}>{pr.principle}</span>
              <span style={{ color: '#6B6459' }}>{pr.reason}</span>
            </div>
          ))}
          <p style={{ fontSize: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            {t('copyCompliance')}:{' '}
            <Pill tone={p.judge.compliance_ok ? 'ok' : 'bad'}>
              {p.judge.compliance_ok ? 'ok' : 'review'}
            </Pill>
          </p>
        </div>
      </div>

      {/* Hooks — with recommended highlight and multi-select for creative engine. */}
      {p.hooks.length > 0 && (
        <div style={cardStyle}>
          <h3 style={{ ...cardTitleStyle, marginBottom: '14px' }}>{t('copyHooksTitle')}</h3>
          <div className="flex flex-col gap-4">
            <HooksList hooks={p.hooks} />
            <div style={{ borderTop: '1px solid #DED8CB', paddingTop: '16px' }}>
              <p style={{ marginBottom: '12px', fontSize: '14px', fontWeight: 500, color: '#6B6459' }}>
                בחר hooks לשימוש ב-Creative Engine:
              </p>
              <HookSelectorPanel
                generationId={generationId}
                hooks={p.hooks}
                initialSelectedIndices={initialSelectedIndices}
              />
            </div>
          </div>
        </div>
      )}

      {/* Variants — bilingual, each with its Edit-Loop control. */}
      {p.variants.map((v, i) => (
        <div key={`${v.lang}-${i}`} style={cardStyle}>
          <div className="flex items-center gap-2" style={{ marginBottom: '12px' }}>
            <Pill>{v.lang.toUpperCase()}</Pill>
            <h3 style={cardTitleStyle}>{v.headline}</h3>
          </div>
          <div className="flex flex-col gap-3">
            {v.subheadline && (
              <p style={{ fontSize: '14px', fontWeight: 500, color: '#6B6459' }}>{v.subheadline}</p>
            )}
            <p dir={v.lang === 'he' ? 'rtl' : 'ltr'} style={{ whiteSpace: 'pre-wrap', fontSize: '14px' }}>
              {v.primary_text}
            </p>
            <p style={{ fontSize: '14px', color: '#6B6459' }}>
              {t('copyHook')}: {v.hook}
            </p>
            {v.cta_button && (
              <p style={{ fontSize: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontWeight: 500, color: '#6B6459' }}>CTA: </span>
                <Pill>{v.cta_button}</Pill>
              </p>
            )}
            <AdCopyEditor
              generationId={generationId}
              variantLang={v.lang}
              variantIndex={i}
              originalText={v.primary_text}
            />
          </div>
        </div>
      ))}
    </div>
  )
}
