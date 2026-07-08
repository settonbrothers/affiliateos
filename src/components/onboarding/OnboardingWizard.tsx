'use client'

import { useTranslations } from 'next-intl'
import { useState, useTransition } from 'react'

import { EditorialSection } from '@/components/brand/editorial/EditorialSection'
import { EditorialSurface } from '@/components/brand/editorial/EditorialSurface'
import { saveOnboarding } from '@/lib/actions/onboarding'
import {
  CASHFLOW_TOLERANCES,
  EXPERIENCE_LEVELS,
  type OnboardingInput,
} from '@/lib/validations/onboarding'
import { TRAFFIC_CHANNELS } from '@/types/agents/testKit'
import type { Vertical } from '@/types/db'

function Choice({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        border: `1px solid ${active ? '#1F1B16' : '#DED8CB'}`,
        background: active ? '#1F1B16' : '#FFFFFF',
        color: active ? '#FFFFFF' : '#1F1B16',
        padding: '8px 14px',
        fontSize: '13px',
        fontWeight: active ? 500 : 400,
        textTransform: 'capitalize',
        cursor: 'pointer',
      }}
    >
      {String(children).replace(/_/g, ' ')}
    </button>
  )
}

const navSecondary: React.CSSProperties = {
  fontFamily: 'var(--font-sans)',
  fontWeight: 600,
  fontSize: '14px',
  color: '#FFFFFF',
  background: 'transparent',
  border: '1px solid var(--border)',
  padding: '10px 18px',
  cursor: 'pointer',
}

const navPrimary: React.CSSProperties = {
  fontFamily: 'var(--font-sans)',
  fontWeight: 700,
  fontSize: '14px',
  color: '#0A0A0A',
  background: 'var(--primary)',
  border: 'none',
  padding: '10px 18px',
  cursor: 'pointer',
}

export function OnboardingWizard({ verticals }: { verticals: Vertical[] }) {
  const t = useTranslations('onboarding')
  const steps = [
    t('stepWhoYouAre'),
    t('stepHowYouBuy'),
    t('stepYourFocus'),
    t('stepReady'),
  ]
  const [step, setStep] = useState(0)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const [experience, setExperience] = useState<string>('')
  const [cashflow, setCashflow] = useState<string>('')
  const [channels, setChannels] = useState<string[]>([])
  const [budgetMin, setBudgetMin] = useState('')
  const [budgetMax, setBudgetMax] = useState('')
  const [verticalId, setVerticalId] = useState('')

  function toggleChannel(c: string) {
    setChannels((prev) =>
      prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]
    )
  }

  function finish() {
    setError(null)
    if (budgetMin && budgetMax && Number(budgetMin) > Number(budgetMax)) {
      setError('Budget minimum cannot exceed maximum')
      return
    }
    const payload: OnboardingInput = {
      experience_level: (experience || undefined) as OnboardingInput['experience_level'],
      cashflow_tolerance: (cashflow || undefined) as OnboardingInput['cashflow_tolerance'],
      primary_channels: channels as OnboardingInput['primary_channels'],
      budget_min_usd: budgetMin ? Number(budgetMin) : undefined,
      budget_max_usd: budgetMax ? Number(budgetMax) : undefined,
      preferred_vertical_id: verticalId || undefined,
    }
    startTransition(async () => {
      const result = await saveOnboarding(payload)
      if (result && 'error' in result) setError(result.error)
    })
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0D0B09' }}>
      {/* Band A - dark hero */}
      <div
        style={{
          padding: 'clamp(28px,4vw,52px) clamp(24px,4vw,48px)',
          background: 'radial-gradient(100% 130% at 20% 0%, #17140A 0%, #0D0B09 62%)',
        }}
      >
        <div
          dir="ltr"
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '11px',
            letterSpacing: '0.2em',
            color: 'var(--muted-fainter)',
            marginBottom: '16px',
          }}
        >
          {t('kicker')}
        </div>
        <h1
          style={{
            margin: 0,
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(34px,5vw,56px)',
            fontWeight: 600,
            lineHeight: 0.95,
            color: '#FFFFFF',
          }}
        >
          {t('welcomeTitle')}
        </h1>
        <p style={{ margin: '12px 0 0', fontSize: '14px', color: 'var(--muted-foreground)', maxWidth: '60ch' }}>
          {t('welcomeSubtitle')}
        </p>
        <div
          dir="ltr"
          style={{ marginTop: '20px', display: 'flex', gap: '10px', fontFamily: 'var(--font-mono)', fontSize: '13px' }}
        >
          {steps.map((s, i) => (
            <span
              key={s}
              style={{ color: i === step ? 'var(--primary)' : i < step ? '#B2B2B0' : '#5E5E5C' }}
            >
              {i + 1}
              {i < steps.length - 1 ? ' ·' : ''}
            </span>
          ))}
        </div>
      </div>

      {/* Band B - white body */}
      <EditorialSurface>
        <EditorialSection label={steps[step] ?? ''}>
          {step === 0 && (
            <div className="flex flex-col gap-5">
              <div className="flex flex-col gap-2">
                <label className="affex-light-label">{t('experienceLabel')}</label>
                <div className="flex flex-wrap gap-2">
                  {EXPERIENCE_LEVELS.map((e) => (
                    <Choice key={e} active={experience === e} onClick={() => setExperience(e)}>
                      {e}
                    </Choice>
                  ))}
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <label className="affex-light-label">{t('cashflowLabel')}</label>
                <div className="flex flex-wrap gap-2">
                  {CASHFLOW_TOLERANCES.map((c) => (
                    <Choice key={c} active={cashflow === c} onClick={() => setCashflow(c)}>
                      {c}
                    </Choice>
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="flex flex-col gap-5">
              <div className="flex flex-col gap-2">
                <label className="affex-light-label">{t('channelsLabel')}</label>
                <div className="flex flex-wrap gap-2">
                  {TRAFFIC_CHANNELS.map((c) => (
                    <Choice key={c} active={channels.includes(c)} onClick={() => toggleChannel(c)}>
                      {c}
                    </Choice>
                  ))}
                </div>
              </div>
              <div className="flex gap-4">
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="bmin" className="affex-light-label">{t('budgetMinLabel')}</label>
                  <input id="bmin" type="number" className="affex-light-field" style={{ width: '140px' }} value={budgetMin} onChange={(e) => setBudgetMin(e.target.value)} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="bmax" className="affex-light-label">{t('budgetMaxLabel')}</label>
                  <input id="bmax" type="number" className="affex-light-field" style={{ width: '140px' }} value={budgetMax} onChange={(e) => setBudgetMax(e.target.value)} />
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="flex flex-col gap-2">
              <label htmlFor="vertical" className="affex-light-label">{t('verticalLabel')}</label>
              <select
                id="vertical"
                className="affex-light-select"
                style={{ maxWidth: '24rem' }}
                value={verticalId}
                onChange={(e) => setVerticalId(e.target.value)}
              >
                <option value="">{t('noPreference')}</option>
                {verticals.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {step === 3 && (
            <div className="flex flex-col gap-2">
              <p style={{ fontSize: '15px', color: '#1F1B16' }}>{t('readyLine')}</p>
              <p style={{ fontSize: '14px', color: '#6B6459' }}>
                {experience || '·'} · {cashflow || '·'} cashflow ·{' '}
                {channels.length ? channels.join(', ') : 'no channels'} ·{' '}
                {budgetMin || budgetMax ? `$${budgetMin || '0'}–${budgetMax || '?'}` : 'no budget'}
              </p>
            </div>
          )}
        </EditorialSection>
        {error && <p style={{ marginTop: '16px', fontSize: '13px', color: '#B23A24' }}>{error}</p>}
      </EditorialSurface>

      {/* Band C - dark closing nav */}
      <div
        style={{
          background: '#0D0B09',
          padding: 'clamp(20px,3vw,28px) clamp(24px,4vw,48px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          flexWrap: 'wrap',
        }}
      >
        <button
          type="button"
          disabled={step === 0 || isPending}
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          style={{ ...navSecondary, opacity: step === 0 || isPending ? 0.4 : 1 }}
        >
          {t('back')}
        </button>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={isPending}
            onClick={finish}
            style={navSecondary}
          >
            {t('skip')}
          </button>
          {step < steps.length - 1 ? (
            <button type="button" className="affex-cta" onClick={() => setStep((s) => s + 1)} style={navPrimary}>
              {t('next')}
            </button>
          ) : (
            <button type="button" className="affex-cta" disabled={isPending} onClick={finish} style={{ ...navPrimary, opacity: isPending ? 0.6 : 1 }}>
              {isPending ? t('saving') : t('finish')}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
