import { getTranslations } from 'next-intl/server'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { AdCopyEditor } from '@/components/offers/AdCopyEditor'
import { HooksList } from '@/components/offers/HooksList'
import { HookSelectorPanel } from '@/components/offers/HookSelectorPanel'
import type { AdCopyResponse } from '@/types/agents/adCopy'

const OK_BADGE = 'border-green-300 bg-green-50 text-green-700 dark:bg-green-950/40'
const BAD_BADGE = 'border-red-300 bg-red-50 text-red-700 dark:bg-red-950/40'

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
    return <p className="text-sm text-red-600">{t('copyMalformed')}</p>
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Judge — advisory until calibrated against the human Taste Corpus. */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            {t('copyJudgeTitle')}
            <Badge className={p.judge.calibrated ? OK_BADGE : undefined}>
              {p.judge.calibrated ? t('copyJudgeCalibrated') : t('copyJudgeAdvisory')}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {p.judge.principles.map((pr) => (
            <div key={pr.principle} className="flex items-start gap-2 text-sm">
              <Badge className={pr.verdict === 'pass' ? OK_BADGE : BAD_BADGE}>
                {pr.verdict}
              </Badge>
              <span className="font-medium">{pr.principle}</span>
              <span className="text-[var(--color-muted-foreground)]">{pr.reason}</span>
            </div>
          ))}
          <p className="text-sm">
            {t('copyCompliance')}:{' '}
            <Badge className={p.judge.compliance_ok ? OK_BADGE : BAD_BADGE}>
              {p.judge.compliance_ok ? 'ok' : 'review'}
            </Badge>
          </p>
        </CardContent>
      </Card>

      {/* Hooks — with recommended highlight and multi-select for creative engine. */}
      {p.hooks.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('copyHooksTitle')}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <HooksList hooks={p.hooks} />
            <div className="border-t pt-4">
              <p className="mb-3 text-sm font-medium text-[var(--color-muted-foreground)]">
                בחר hooks לשימוש ב-Creative Engine:
              </p>
              <HookSelectorPanel
                generationId={generationId}
                hooks={p.hooks}
                initialSelectedIndices={initialSelectedIndices}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Variants — bilingual, each with its Edit-Loop control. */}
      {p.variants.map((v, i) => (
        <Card key={`${v.lang}-${i}`}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Badge>{v.lang.toUpperCase()}</Badge>
              {v.headline}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {v.subheadline && (
              <p className="text-sm font-medium text-[var(--color-muted-foreground)]">
                {v.subheadline}
              </p>
            )}
            <p
              dir={v.lang === 'he' ? 'rtl' : 'ltr'}
              className="whitespace-pre-wrap text-sm"
            >
              {v.primary_text}
            </p>
            <p className="text-sm text-[var(--color-muted-foreground)]">
              {t('copyHook')}: {v.hook}
            </p>
            {v.cta_button && (
              <p className="text-sm">
                <span className="font-medium text-[var(--color-muted-foreground)]">CTA: </span>
                <Badge>{v.cta_button}</Badge>
              </p>
            )}
            <AdCopyEditor
              generationId={generationId}
              variantLang={v.lang}
              variantIndex={i}
              originalText={v.primary_text}
            />
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
