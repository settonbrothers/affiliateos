'use client'

import Link from 'next/link'

import { cn } from '@/lib/utils'

export type WizardStep = {
  key: string
  label: string
  isComplete: boolean
  isLocked: boolean
  isSkippable: boolean
  isActive: boolean
  href: string
}

export type CampaignWizardProps = {
  steps: WizardStep[]
  children: React.ReactNode
  completedCount: number
  totalCount: number
}

export function CampaignWizard({
  steps,
  children,
  completedCount,
  totalCount,
}: CampaignWizardProps) {
  const progressPercent = totalCount > 0 ? (completedCount / totalCount) * 100 : 0

  return (
    <div className="flex flex-col gap-4">
      {/* Progress bar */}
      <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--color-muted)]">
        <div
          className="h-full rounded-full bg-green-500 transition-all duration-300"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* Step indicators */}
      <div className="flex items-center gap-1 overflow-x-auto border-b border-[var(--color-border)] pb-3">
        {steps.map((step, index) => {
          const isFirst = index === 0
          const stepContent = (
            <span
              className={cn(
                'flex items-center gap-1.5 whitespace-nowrap px-2 py-1.5 text-sm',
                step.isActive && 'font-bold underline underline-offset-4',
                step.isLocked && 'cursor-not-allowed opacity-40',
                step.isComplete && !step.isActive && 'text-green-600',
                !step.isComplete &&
                  !step.isLocked &&
                  !step.isActive &&
                  'text-[var(--color-muted-foreground)]',
                step.isSkippable && !step.isComplete && !step.isLocked && 'opacity-70'
              )}
            >
              {/* Status icon */}
              {step.isLocked ? (
                <span aria-label="locked">🔒</span>
              ) : step.isComplete ? (
                <span aria-label="complete">✅</span>
              ) : step.isSkippable ? (
                <span aria-label="skippable">⏭️</span>
              ) : (
                <span
                  aria-label="available"
                  className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-current text-xs leading-none"
                >
                  ○
                </span>
              )}
              {step.label}
            </span>
          )

          return (
            <div key={step.key} className="flex items-center">
              {/* Separator */}
              {!isFirst && (
                <span className="mx-0.5 text-xs text-[var(--color-muted-foreground)]">
                  ›
                </span>
              )}
              {step.isLocked ? (
                stepContent
              ) : (
                <Link href={step.href}>{stepContent}</Link>
              )}
            </div>
          )
        })}
      </div>

      {/* Active step content */}
      <div>{children}</div>
    </div>
  )
}
