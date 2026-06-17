'use client'

import { useTranslations } from 'next-intl'
import { useState, useTransition } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { saveOnboarding } from '@/lib/actions/onboarding'
import {
  CASHFLOW_TOLERANCES,
  EXPERIENCE_LEVELS,
  type OnboardingInput,
} from '@/lib/validations/onboarding'
import { TRAFFIC_CHANNELS } from '@/types/agents/testKit'
import type { Vertical } from '@/types/db'
import { cn } from '@/lib/utils'

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
      className={cn(
        'rounded-md border px-3 py-2 text-sm capitalize',
        active
          ? 'border-[var(--color-foreground)] bg-[var(--color-muted)] font-medium'
          : 'border-[var(--color-border)]'
      )}
    >
      {String(children).replace(/_/g, ' ')}
    </button>
  )
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
    const payload: OnboardingInput = {
      experience_level: (experience || undefined) as OnboardingInput['experience_level'],
      cashflow_tolerance: (cashflow || undefined) as OnboardingInput['cashflow_tolerance'],
      primary_channels: channels as OnboardingInput['primary_channels'],
      budget_min_usd: budgetMin ? Number(budgetMin) : undefined,
      budget_max_usd: budgetMax ? Number(budgetMax) : undefined,
      preferred_vertical_id: verticalId || '',
    }
    startTransition(async () => {
      const result = await saveOnboarding(payload)
      if (result && 'error' in result) setError(result.error)
    })
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex gap-2 text-xs">
        {steps.map((s, i) => (
          <span
            key={s}
            className={cn(
              'rounded-full px-2 py-0.5',
              i === step
                ? 'bg-[var(--color-foreground)] text-[var(--color-background)]'
                : 'bg-[var(--color-muted)] text-[var(--color-muted-foreground)]'
            )}
          >
            {i + 1}. {s}
          </span>
        ))}
      </div>

      {step === 0 && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label>{t('experienceLabel')}</Label>
            <div className="flex flex-wrap gap-2">
              {EXPERIENCE_LEVELS.map((e) => (
                <Choice key={e} active={experience === e} onClick={() => setExperience(e)}>
                  {e}
                </Choice>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label>{t('cashflowLabel')}</Label>
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
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label>{t('channelsLabel')}</Label>
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
              <Label htmlFor="bmin">{t('budgetMinLabel')}</Label>
              <Input
                id="bmin"
                type="number"
                className="w-32"
                value={budgetMin}
                onChange={(e) => setBudgetMin(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="bmax">{t('budgetMaxLabel')}</Label>
              <Input
                id="bmax"
                type="number"
                className="w-32"
                value={budgetMax}
                onChange={(e) => setBudgetMax(e.target.value)}
              />
            </div>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="flex flex-col gap-2">
          <Label htmlFor="vertical">{t('verticalLabel')}</Label>
          <select
            id="vertical"
            className="flex h-10 w-full max-w-sm rounded-md border border-[var(--color-border)] bg-[var(--color-background)] px-3 text-sm"
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
        <div className="flex flex-col gap-2 text-sm">
          <p>{t('readyLine')}</p>
          <p className="text-[var(--color-muted-foreground)]">
            {experience || '—'} · {cashflow || '—'} cashflow ·{' '}
            {channels.length ? channels.join(', ') : 'no channels'} ·{' '}
            {budgetMin || budgetMax ? `$${budgetMin || '0'}–${budgetMax || '?'}` : 'no budget'}
          </p>
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex items-center justify-between">
        <Button
          type="button"
          variant="outline"
          disabled={step === 0 || isPending}
          onClick={() => setStep((s) => Math.max(0, s - 1))}
        >
          {t('back')}
        </Button>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={isPending}
            onClick={finish}
          >
            {t('skip')}
          </Button>
          {step < steps.length - 1 ? (
            <Button type="button" onClick={() => setStep((s) => s + 1)}>
              {t('next')}
            </Button>
          ) : (
            <Button type="button" disabled={isPending} onClick={finish}>
              {isPending ? t('saving') : t('finish')}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
