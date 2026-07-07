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
  return (
    <div className="flex flex-col gap-4">
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '14px', marginBottom: '20px' }}>
        <span style={{ width: '4px', height: '22px', background: 'var(--primary)' }} />
        <span style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(20px,2.4vw,28px)', fontWeight: 600, letterSpacing: '0.03em' }}>THE PIPELINE</span>
        <span dir="ltr" style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: '#6E6E6C', marginInlineStart: 'auto' }}>{completedCount} / {totalCount} COMPLETE</span>
      </div>

      {/* Step indicators */}
      <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
        {steps.map((step, index) => {
          const stepContent = (
            <div
              className={cn(step.isLocked && 'cursor-not-allowed')}
              aria-current={step.isActive ? 'step' : undefined}
              style={{
                flex: 1,
                minWidth: '118px',
                border: `1px solid ${step.isActive ? 'var(--accent-border)' : 'var(--border)'}`,
                background: step.isActive ? 'var(--accent-fill)' : step.isLocked ? '#090909' : '#0C0C0C',
                padding: '14px 14px 16px',
                position: 'relative',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '26px',
                    height: '26px',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '12px',
                    fontWeight: 600,
                    color: step.isComplete ? '#0A0A0A' : step.isLocked ? '#5E5E5C' : step.isActive ? 'var(--primary)' : '#C9C9C7',
                    background: step.isComplete ? 'var(--primary)' : 'transparent',
                    border: `1px solid ${step.isComplete || step.isActive ? 'var(--primary)' : 'rgba(255,255,255,0.18)'}`,
                  }}
                >
                  {step.isComplete ? '✓' : String(index + 1).padStart(2, '0')}
                </span>
                <span aria-hidden style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: step.isLocked ? '#4E4E4C' : '#6E6E6C' }}>
                  {step.isLocked ? '🔒' : step.isComplete ? '' : '›'}
                </span>
              </div>
              <div style={{ fontSize: '13px', fontWeight: 500, color: step.isLocked ? '#6E6E6C' : '#FFFFFF' }}>{step.label}</div>
              <span style={{ position: 'absolute', width: 1, height: 1, padding: 0, margin: -1, overflow: 'hidden', clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap', border: 0 }}>
                {step.isLocked ? 'locked' : step.isComplete ? 'complete' : 'available'}
              </span>
              {step.isActive && <span style={{ position: 'absolute', insetInline: 0, bottom: '-1px', height: '2px', background: 'var(--primary)' }} />}
            </div>
          )

          return (
            <div key={step.key} style={{ display: 'flex', flex: 1 }}>
              {step.isLocked ? (
                stepContent
              ) : (
                <Link href={step.href} style={{ display: 'flex', flex: 1 }}>{stepContent}</Link>
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
