import { getLocale, getTranslations } from 'next-intl/server'
import { notFound } from 'next/navigation'

import { CampaignResultsForm } from '@/components/campaigns/CampaignResultsForm'
import { DiagnoseButton } from '@/components/campaigns/DiagnoseButton'
import { DiagnoseCreativesForm } from '@/components/campaigns/DiagnoseCreativesForm'
import { DiagnoseV2Display } from '@/components/campaigns/DiagnoseV2Display'
import { DiagnosisView } from '@/components/campaigns/DiagnosisView'
import { TranslationFiller } from '@/components/i18n/TranslationFiller'
import {
  getTranslatedPayload,
  shouldTranslate,
} from '@/lib/i18n/translatedPayload'
import {
  getCampaign,
  getCampaignResults,
  getLatestDiagnosis,
} from '@/lib/queries/campaigns'

type StatusTier = 'active' | 'draft' | 'muted'

function statusTier(status: string): StatusTier {
  const s = status.toLowerCase()
  if (s === 'active' || s === 'live' || s === 'running' || s === 'results_entered' || s === 'diagnosed')
    return 'active'
  if (s === 'draft') return 'draft'
  return 'muted'
}

function StatusChip({ status }: { status: string }) {
  const tier = statusTier(status)
  if (tier === 'active') {
    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '7px',
          fontFamily: 'var(--font-sans)',
          fontSize: '12px',
          fontWeight: 700,
          color: '#0A0A0A',
          background: 'var(--primary)',
          padding: '5px 11px',
        }}
      >
        <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#0A0A0A' }} />
        {status}
      </span>
    )
  }
  if (tier === 'draft') {
    return (
      <span
        style={{
          fontFamily: 'var(--font-sans)',
          fontSize: '12px',
          fontWeight: 700,
          color: '#FFFFFF',
          background: 'transparent',
          border: '1px solid var(--border)',
          padding: '5px 11px',
        }}
      >
        {status}
      </span>
    )
  }
  return (
    <span
      style={{
        fontFamily: 'var(--font-sans)',
        fontSize: '12px',
        fontWeight: 700,
        color: 'var(--muted-foreground)',
        background: 'transparent',
        border: '1px solid rgba(255,255,255,0.08)',
        padding: '5px 11px',
      }}
    >
      {status}
    </span>
  )
}

function SectionHeading({ label }: { label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: '14px' }}>
      <span style={{ width: '4px', height: '24px', background: 'var(--primary)', flexShrink: 0 }} />
      <span
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: 'clamp(24px,3vw,36px)',
          fontWeight: 600,
          letterSpacing: '0.02em',
          color: '#1F1B16',
          textTransform: 'uppercase',
        }}
      >
        {label}
      </span>
    </div>
  )
}

export default async function CampaignDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const campaign = await getCampaign(id)
  if (!campaign) notFound()

  const results = await getCampaignResults(id)
  const diagnosis = await getLatestDiagnosis(id)
  const locale = await getLocale()
  const diagnosisPayload = diagnosis
    ? await getTranslatedPayload(
        'result_diagnoses',
        diagnosis.id,
        locale,
        diagnosis.payload
      )
    : null
  const t = await getTranslations('campaigns')

  const metaParts = [campaign.offers?.name, campaign.channel, campaign.geo].filter(
    (part): part is string => !!part
  )

  return (
    <div
      className="flex flex-col"
      style={{
        gap: 0,
        // Full-bleed: cancel the app layout's <main> padding so the bands span
        // edge-to-edge (Selezione full-width editorial look).
        marginTop: 'calc(-1 * clamp(28px,4vw,52px))',
        marginBottom: '-40px',
        marginInlineStart: 'calc(-1 * clamp(20px,4vw,64px))',
        marginInlineEnd: 'calc(-1 * clamp(20px,4vw,64px))',
      }}
    >
      {/* Band A - dark hero */}
      <div
        style={{
          padding: 'clamp(28px,4vw,52px) clamp(24px,4vw,48px)',
          background:
            'radial-gradient(100% 130% at 20% 0%, #17140A 0%, #0D0B09 62%)',
        }}
      >
        <div
          dir="ltr"
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '11px',
            letterSpacing: '0.1em',
            color: 'var(--muted-fainter)',
            marginBottom: '20px',
          }}
        >
          ‹ CAMPAIGNS&nbsp;
          <span style={{ color: 'var(--border)' }}>/</span>
          &nbsp;
          <span>{campaign.name.toUpperCase()}</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
          <h1
            style={{
              margin: 0,
              fontFamily: 'var(--font-display)',
              fontSize: 'clamp(40px,6vw,64px)',
              fontWeight: 600,
              lineHeight: 0.9,
              color: '#FFFFFF',
            }}
          >
            {campaign.name}
          </h1>
          <StatusChip status={campaign.status} />
        </div>

        {metaParts.length > 0 && (
          <div
            dir="ltr"
            style={{
              marginTop: '12px',
              fontFamily: 'var(--font-mono)',
              fontSize: '12px',
              color: 'var(--muted-foreground)',
              display: 'flex',
              gap: '12px',
              flexWrap: 'wrap',
            }}
          >
            {metaParts.map((part, i) => (
              <span key={i} style={{ display: 'flex', gap: '12px' }}>
                {i > 0 && <span style={{ color: 'var(--muted-fainter)' }}>·</span>}
                <span>{part}</span>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Band B - white editorial body */}
      <div
        style={{
          background: '#F6F4EF',
          color: '#1F1B16',
          padding: 'clamp(32px,5vw,64px) clamp(24px,4vw,48px)',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'clamp(36px,5vw,56px)' }}>
          <section className="flex flex-col gap-5" style={{ paddingTop: 'clamp(28px,4vw,40px)', borderTop: '1px solid #DED8CB' }}>
            <SectionHeading label={t('resultsHeading')} />
            <CampaignResultsForm
              campaignId={campaign.id}
              initial={results ?? undefined}
            />
          </section>

          <section className="flex flex-col gap-5" style={{ paddingTop: 'clamp(28px,4vw,40px)', borderTop: '1px solid #DED8CB' }}>
            <SectionHeading label={t('diagnosisHeading')} />
            <DiagnoseButton
              campaignId={campaign.id}
              hasResults={!!results}
              hasDiagnosis={!!diagnosis}
            />
            {diagnosis ? (
              <>
                <DiagnosisView payload={diagnosisPayload} />
                {shouldTranslate(locale, diagnosis.payload) && (
                  <TranslationFiller
                    sourceTable="result_diagnoses"
                    sourceId={diagnosis.id}
                    locale={locale}
                  />
                )}
              </>
            ) : (
              <p style={{ fontSize: '14px', color: '#6B6459' }}>
                {t('diagnosisEmpty')}
              </p>
            )}
          </section>

          <section className="flex flex-col gap-5" style={{ paddingTop: 'clamp(28px,4vw,40px)', borderTop: '1px solid #DED8CB' }}>
            <SectionHeading label="WINNING HOOKS" />
            <p style={{ fontFamily: 'var(--font-sans)', fontSize: '13px', color: '#6B6459', marginTop: '-8px' }}>
              ניתוח קריאייטיבים (V2) · הדבק טקסט מודעות שרצו כדי למצוא winning hooks
            </p>
            <DiagnoseCreativesForm campaignId={campaign.id} />
            {diagnosis?.creative_analysis ? (
              <DiagnoseV2Display
                creativeAnalysis={diagnosis.creative_analysis}
                winningHooks={diagnosis.winning_hooks}
                winnersAddedToLibrary={diagnosis.winners_added_to_library}
              />
            ) : (
              <p style={{ fontSize: '14px', color: '#6B6459' }}>
                הדבק טקסט מודעות שרצו כדי לנתח קריאייטיבים ולמצוא winning hooks.
              </p>
            )}
          </section>
        </div>
      </div>

      {/* Band C - dark closing band */}
      <div
        dir="ltr"
        style={{
          background: '#0D0B09',
          padding: 'clamp(20px,3vw,28px) clamp(24px,4vw,48px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '10px',
        }}
      >
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            fontFamily: 'var(--font-mono)',
            fontSize: '10.5px',
            letterSpacing: '0.12em',
            color: 'var(--muted-fainter)',
          }}
        >
          <span
            className="animate-pulse"
            style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              background: 'var(--primary)',
            }}
          />
          AFFEX · CAMPAIGN INTELLIGENCE
        </span>
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '10.5px',
            letterSpacing: '0.12em',
            color: 'var(--muted-foreground)',
          }}
        >
          {campaign.status.toUpperCase()}
        </span>
      </div>
    </div>
  )
}
