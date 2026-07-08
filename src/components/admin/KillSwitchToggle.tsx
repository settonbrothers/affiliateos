'use client'

import { useState, useTransition } from 'react'

import { toggleKillSwitch } from '@/lib/actions/killSwitches'

export type KillSwitchRow = {
  orchestrator_name: string
  is_paused: boolean
  reason: string | null
  paused_at: string | null
}

export function KillSwitchToggle({ row }: { row: KillSwitchRow }) {
  const [isPending, startTransition] = useTransition()
  const [reason, setReason] = useState('')
  const paused = row.is_paused

  function onToggle() {
    startTransition(async () => {
      await toggleKillSwitch(row.orchestrator_name, !paused, reason || undefined)
      setReason('')
    })
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '16px',
        border: '1px solid rgba(255,255,255,0.1)',
        background: '#0C0C0C',
        padding: '18px 22px',
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div dir="ltr" style={{ fontFamily: 'var(--font-display)', fontSize: '17px', fontWeight: 500, textAlign: 'right' }}>
          {row.orchestrator_name}
        </div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10.5px', color: paused ? '#C97A6E' : 'var(--primary)', marginTop: '4px' }}>
          {paused
            ? `מושהה · 503${row.paused_at ? ` · ${new Date(row.paused_at).toLocaleString()}` : ''}${row.reason ? ` · ${row.reason}` : ''}`
            : 'פעיל'}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        {!paused && (
          <input
            className="affex-fld"
            style={{ width: '220px', padding: '9px 12px', fontSize: '13px' }}
            placeholder="reason (optional)"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        )}
        <button
          type="button"
          onClick={onToggle}
          disabled={isPending}
          aria-label={paused ? 'Resume' : 'Pause'}
          style={{
            width: '52px',
            height: '28px',
            background: paused ? 'rgba(201,122,110,0.2)' : 'rgba(245,197,24,0.22)',
            border: `1px solid ${paused ? 'rgba(201,122,110,0.4)' : 'rgba(245,197,24,0.5)'}`,
            position: 'relative',
            cursor: isPending ? 'default' : 'pointer',
            opacity: isPending ? 0.6 : 1,
            transition: 'background 0.2s',
            flexShrink: 0,
          }}
        >
          <span
            style={{
              position: 'absolute',
              top: '3px',
              ...(paused ? { right: '3px' } : { left: '3px' }),
              width: '20px',
              height: '20px',
              background: paused ? '#C97A6E' : 'var(--primary)',
              transition: 'all 0.2s',
            }}
          />
        </button>
      </div>
    </div>
  )
}
