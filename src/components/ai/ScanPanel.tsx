'use client'

import { useEffect, useState } from 'react'

/**
 * T2/T3 inline "thinking" panel: a dark terminal scan strip shown while a
 * deliverable/diagnosis AI action runs. Narrates rotating step labels with an
 * indeterminate sweep + elapsed timer (honest — no fake progress). Render it
 * conditionally on `isRunning`. See the AI waiting-states spec.
 */
export function ScanPanel({ title, steps }: { title: string; steps: string[] }) {
  const [elapsed, setElapsed] = useState(0)
  const [stepIdx, setStepIdx] = useState(0)

  useEffect(() => {
    const sec = setInterval(() => setElapsed((s) => s + 1), 1000)
    const st = setInterval(() => setStepIdx((i) => (i + 1) % Math.max(1, steps.length)), 1800)
    return () => {
      clearInterval(sec)
      clearInterval(st)
    }
  }, [steps.length])

  return (
    <div
      dir="rtl"
      aria-live="polite"
      style={{ width: '100%', border: '1px solid rgba(255,255,255,0.12)', background: '#0C0C0C', color: '#FFFFFF', padding: '18px 20px' }}
    >
      <div
        dir="ltr"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontFamily: 'var(--font-mono)',
          fontSize: '10px',
          letterSpacing: '0.14em',
          marginBottom: '14px',
        }}
      >
        <span style={{ color: '#7A7A78' }}>
          AFFEX ▸ <span style={{ color: '#C9C9C7' }}>WORKING</span>
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#8A8A88' }}>
          <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--primary)', animation: 'affexPulseDot 1.4s ease-in-out infinite' }} />
          {elapsed}s
        </span>
      </div>

      <div dir="ltr" style={{ fontFamily: 'var(--font-display)', fontSize: '22px', fontWeight: 600, color: '#EDEDEB' }}>
        {title}
      </div>

      <div
        dir="ltr"
        style={{
          marginTop: '10px',
          fontFamily: 'var(--font-mono)',
          fontSize: '11.5px',
          color: '#C99A0F',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          minHeight: '16px',
        }}
      >
        <span>◈ {steps[stepIdx] ?? ''}</span>
        <span style={{ animation: 'affexBlink 1s step-end infinite', color: 'var(--primary)' }}>▊</span>
      </div>

      <div style={{ marginTop: '16px', position: 'relative', height: '3px', background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: 0, bottom: 0, width: '40%', background: 'linear-gradient(90deg, transparent, rgba(245,197,24,0.5), transparent)', animation: 'affexSweep 1.1s linear infinite' }} />
      </div>
    </div>
  )
}
