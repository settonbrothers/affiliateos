import Link from 'next/link'

import { getCampaignViewData } from '@/lib/queries/campaignView'
import { ExportButton } from './ExportButton'

const EMPTY_PLACEHOLDER = 'עדיין לא נוצר — לך לטאב הרלוונטי כדי ליצור'

function SectionCard({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="rounded-md border border-[var(--color-border)] p-4">
      <h3 className="mb-3 text-sm font-semibold text-[var(--color-foreground)]">
        {title}
      </h3>
      {children}
    </div>
  )
}

function Field({ label, value }: { label: string; value?: unknown }) {
  if (!value) return null
  return (
    <div className="mb-2">
      <p className="text-xs font-medium text-[var(--color-muted-foreground)]">{label}</p>
      <p className="text-sm text-[var(--color-foreground)]">{String(value)}</p>
    </div>
  )
}

function EmptySection() {
  return (
    <p className="text-sm text-[var(--color-muted-foreground)]">{EMPTY_PLACEHOLDER}</p>
  )
}

export async function CampaignView({
  offerId,
  offerName,
}: {
  offerId: string
  offerName: string
}) {
  const data = await getCampaignViewData(offerId)

  return (
    <div className="flex flex-col gap-6" dir="rtl">
      {/* Header */}
      <div>
        <h2 className="text-xl font-semibold">Campaign View — {offerName}</h2>
        <p className="text-sm text-[var(--color-muted-foreground)]">
          תצוגת קמפיין מרוכזת — כל הנתונים במקום אחד
        </p>
      </div>

      {/* Section 1 — Deep Brief Summary */}
      <SectionCard title="Deep Brief">
        {data.deepBrief ? (
          <div>
            <Field label="מה אנחנו מוכרים" value={data.deepBrief.what_we_sell} />
            <Field label="הבידול" value={data.deepBrief.main_differentiator} />
            <Field label="טיימינג" value={data.deepBrief.timing} />
            <Link
              href={`/offers/${offerId}?tab=deep-brief`}
              className="mt-2 inline-block text-xs text-[var(--color-muted-foreground)] underline"
            >
              צפה בBrief המלא
            </Link>
          </div>
        ) : (
          <EmptySection />
        )}
      </SectionCard>

      {/* Section 2 — Avatar Summary */}
      <SectionCard title="Avatar">
        {data.avatar ? (
          <div>
            {(() => {
              const painPoints = data.avatar.pain_points
              const desires = data.avatar.desires
              const firstPain = Array.isArray(painPoints) ? painPoints[0] : undefined
              const firstDesire = Array.isArray(desires) ? desires[0] : undefined
              return (
                <>
                  <Field label="כאב עיקרי" value={firstPain} />
                  <Field label="חלום" value={firstDesire} />
                  <Field label="טריגר רגשי" value={data.avatar.emotional_trigger} />
                </>
              )
            })()}
            <Link
              href={`/offers/${offerId}?tab=avatar`}
              className="mt-2 inline-block text-xs text-[var(--color-muted-foreground)] underline"
            >
              צפה באווטאר המלא
            </Link>
          </div>
        ) : (
          <EmptySection />
        )}
      </SectionCard>

      {/* Section 3 — Spy Insights */}
      <SectionCard title="Spy Insights">
        {data.spyInsights ? (
          <div>
            {(() => {
              const winningElements = data.spyInsights.winning_elements
              const gaps = data.spyInsights.gaps_opportunities
              const winningList = Array.isArray(winningElements)
                ? winningElements.slice(0, 3)
                : []
              const gapsList = Array.isArray(gaps) ? gaps.slice(0, 2) : []
              return (
                <>
                  {winningList.length > 0 && (
                    <div className="mb-3">
                      <p className="mb-1 text-xs font-medium text-[var(--color-muted-foreground)]">
                        מה עובד
                      </p>
                      <ul className="list-disc pl-4 text-sm text-[var(--color-foreground)]">
                        {winningList.map((item, i) => (
                          <li key={i}>{String(item)}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {gapsList.length > 0 && (
                    <div>
                      <p className="mb-1 text-xs font-medium text-[var(--color-muted-foreground)]">
                        הזדמנויות
                      </p>
                      <ul className="list-disc pl-4 text-sm text-[var(--color-foreground)]">
                        {gapsList.map((item, i) => (
                          <li key={i}>{String(item)}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {winningList.length === 0 && gapsList.length === 0 && <EmptySection />}
                </>
              )
            })()}
          </div>
        ) : (
          <EmptySection />
        )}
      </SectionCard>

      {/* Section 4 — Hooks */}
      <SectionCard title="Hooks">
        {data.adCopy ? (
          (() => {
            const hooks = data.adCopy.hooks
            const hookList = Array.isArray(hooks) ? hooks : []
            const heHooks = hookList.filter(
              (h) => (h as Record<string, unknown>).lang === 'he'
            )
            const enHooks = hookList.filter(
              (h) => (h as Record<string, unknown>).lang === 'en'
            )
            const ordered = [...heHooks, ...enHooks]
            return ordered.length > 0 ? (
              <ol className="list-decimal pl-4 text-sm text-[var(--color-foreground)]">
                {ordered.map((hook, i) => {
                  const h = hook as Record<string, unknown>
                  return (
                    <li key={i} className="mb-1">
                      <span className="text-xs text-[var(--color-muted-foreground)]">
                        [{String(h.lang ?? '')}]
                      </span>{' '}
                      {String(h.text ?? h.hook ?? JSON.stringify(h))}
                    </li>
                  )
                })}
              </ol>
            ) : (
              <EmptySection />
            )
          })()
        ) : (
          <EmptySection />
        )}
      </SectionCard>

      {/* Section 5 — Copy Preview */}
      <SectionCard title="Copy Preview">
        {data.adCopy ? (
          (() => {
            const variants = data.adCopy.variants
            const variantList = Array.isArray(variants) ? variants : []
            const first = variantList[0] as Record<string, unknown> | undefined
            return first ? (
              <div>
                {!!first.lang && (
                  <p className="mb-1 text-xs font-medium text-[var(--color-muted-foreground)]">
                    שפה: {String(first.lang)}
                  </p>
                )}
                {!!first.headline && (
                  <div className="mb-2">
                    <p className="text-xs font-medium text-[var(--color-muted-foreground)]">
                      Headline
                    </p>
                    <p className="text-sm font-semibold text-[var(--color-foreground)]">
                      {String(first.headline)}
                    </p>
                  </div>
                )}
                {!!first.primary_text && (
                  <div>
                    <p className="text-xs font-medium text-[var(--color-muted-foreground)]">
                      Primary Text
                    </p>
                    <p className="whitespace-pre-wrap text-sm text-[var(--color-foreground)]">
                      {String(first.primary_text)}
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <EmptySection />
            )
          })()
        ) : (
          <EmptySection />
        )}
      </SectionCard>

      {/* Section 6 — Creatives */}
      <SectionCard title="Creatives">
        {data.creatives ? (
          (() => {
            const creatives = data.creatives.creatives
            const creativeList = Array.isArray(creatives) ? creatives : []
            return creativeList.length > 0 ? (
              <div className="grid grid-cols-3 gap-3">
                {creativeList.map((c, i) => {
                  const creative = c as Record<string, unknown>
                  return (
                    <div key={i} className="flex flex-col items-center gap-1">
                      {!!creative.image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={String(creative.image_url)}
                          alt={String(creative.type_label ?? `Creative ${i + 1}`)}
                          className="h-24 w-full rounded-md object-cover"
                        />
                      ) : (
                        <div className="flex h-24 w-full items-center justify-center rounded-md bg-[var(--color-muted)] text-xs text-[var(--color-muted-foreground)]">
                          No image
                        </div>
                      )}
                      {!!creative.type_label && (
                        <p className="text-center text-xs text-[var(--color-muted-foreground)]">
                          {String(creative.type_label)}
                        </p>
                      )}
                    </div>
                  )
                })}
              </div>
            ) : (
              <EmptySection />
            )
          })()
        ) : (
          <EmptySection />
        )}
      </SectionCard>

      {/* Section 7 — Actions */}
      <SectionCard title="פעולות">
        <div className="flex flex-wrap gap-3">
          <ExportButton offerId={offerId} />
          <button
            disabled
            className="cursor-not-allowed rounded-md border border-[var(--color-border)] px-4 py-2 text-sm font-medium text-[var(--color-muted-foreground)] opacity-50"
          >
            ייצוא PDF — בקרוב
          </button>
        </div>
      </SectionCard>
    </div>
  )
}
