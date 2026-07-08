'use client'

import { useEffect, useRef, useState } from 'react'

import { SCORE_DIMENSION_LABELS } from '@/types/agents/underwriting'

const DIMS = Object.keys(SCORE_DIMENSION_LABELS).map((k) =>
  k.replace(/_/g, ' ').toUpperCase()
)

function prefersReducedMotion() {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

/**
 * T1 "Crack Reveal" waiting state for underwriting. A full-screen scan overlay
 * shown while the analyze run is in flight; when `running` flips false it plays
 * a crack-out (fade + blur + scale) over the freshly-refreshed result behind it,
 * then unmounts. See docs/superpowers/specs/2026-07-08-ai-waiting-states-design.md.
 */
export function AnalyzingOverlay({
  running,
  offerName,
  offerUrl,
}: {
  running: boolean
  offerName: string
  offerUrl?: string | null
}) {
  const [mounted, setMounted] = useState(running)
  const [exiting, setExiting] = useState(false)
  const [revealed, setRevealed] = useState(0)
  const [elapsed, setElapsed] = useState(0)
  const wasRunning = useRef(false)

  // Mount when running starts; crack-out then unmount when it stops.
  useEffect(() => {
    if (running) {
      wasRunning.current = true
      setMounted(true)
      setExiting(false)
      setRevealed(0)
      setElapsed(0)
      return
    }
    if (wasRunning.current && mounted) {
      wasRunning.current = false
      if (prefersReducedMotion()) {
        setMounted(false)
        return
      }
      setExiting(true)
      const t = setTimeout(() => setMounted(false), 700)
      return () => clearTimeout(t)
    }
  }, [running, mounted])

  // Reveal dimension lines one by one; hold once all shown.
  useEffect(() => {
    if (!running) return
    const iv = setInterval(() => {
      setRevealed((n) => (n >= DIMS.length ? n : n + 1))
    }, 230)
    const sec = setInterval(() => setElapsed((s) => s + 1), 1000)
    return () => {
      clearInterval(iv)
      clearInterval(sec)
    }
  }, [running])

  if (!mounted) return null

  return (
    <div
      dir="rtl"
      aria-live="polite"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 60,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'clamp(24px,5vw,48px)',
        background: 'radial-gradient(120% 90% at 50% 40%, #16150F 0%, #0A0A08 78%)',
        animation: exiting ? 'affexCrackOut 0.7s cubic-bezier(0.4,0,0.2,1) both' : undefined,
        pointerEvents: exiting ? 'none' : 'auto',
      }}
    >
      <div style={{ width: '100%', maxWidth: '560px' }}>
        <div
          dir="ltr"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontFamily: 'var(--font-mono)',
            fontSize: '10px',
            letterSpacing: '0.14em',
            marginBottom: '28px',
          }}
        >
          <span style={{ color: '#7A7A78' }}>
            AFFEX&nbsp; <span style={{ color: '#45423B' }}>▸</span>&nbsp;{' '}
            <span style={{ color: '#C9C9C7' }}>ANALYZING</span>
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#8A8A88' }}>
            <span
              className="affex-blink"
              style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--primary)', animation: 'affexPulseDot 1.4s ease-in-out infinite' }}
            />
            LIVE
          </span>
        </div>

        <div dir="ltr">
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(28px,4vw,38px)', fontWeight: 600, color: '#EDEDEB' }}>
            {offerName}
          </div>
          {offerUrl && (
            <div style={{ marginTop: '6px', fontFamily: 'var(--font-mono)', fontSize: '11px', color: '#6E6E6C' }}>
              {offerUrl} · underwriting
            </div>
          )}
        </div>

        <div
          dir="ltr"
          style={{
            marginTop: '28px',
            marginBottom: '12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontFamily: 'var(--font-mono)',
            fontSize: '9.5px',
            letterSpacing: '0.16em',
            color: '#55524A',
          }}
        >
          <span>SCORING 13 DIMENSIONS</span>
          <span style={{ color: '#8A8A88' }}>{elapsed}s</span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {DIMS.slice(0, revealed).map((name) => (
            <div
              key={name}
              dir="ltr"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '6px 0',
                borderBottom: '1px solid rgba(255,255,255,0.05)',
                animation: 'affexScanLine 0.34s cubic-bezier(0.2,0.9,0.1,1) both',
              }}
            >
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11.5px', color: '#8C877C', width: '180px', flexShrink: 0 }}>
                {name}
              </span>
              <span style={{ flex: 1, borderBottom: '1px dashed rgba(255,255,255,0.12)', height: '1px' }} />
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--primary)', width: '30px', textAlign: 'right', flexShrink: 0 }}>
                ···
              </span>
            </div>
          ))}
        </div>

        <div style={{ marginTop: '24px', position: 'relative', height: '3px', background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
          <div
            className="affex-sweep"
            style={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              width: '40%',
              background: 'linear-gradient(90deg, transparent, rgba(245,197,24,0.5), transparent)',
              animation: 'affexSweep 1.1s linear infinite',
            }}
          />
        </div>

        <div
          dir="ltr"
          style={{
            marginTop: '16px',
            fontFamily: 'var(--font-mono)',
            fontSize: '11px',
            letterSpacing: '0.12em',
            color: '#C99A0F',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <span>◈ CRACKING OFFER</span>
          <span className="affex-blink" style={{ animation: 'affexBlink 1s step-end infinite', color: 'var(--primary)' }}>▊</span>
        </div>
      </div>
    </div>
  )
}
