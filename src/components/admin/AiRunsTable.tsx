import Link from 'next/link'

export type AdminAiRunRow = {
  id: string
  orchestrator_name: string
  status: string
  estimated_cost: string | number | null
  started_at: string
  completed_at: string | null
  created_at: string
  profiles: { email: string } | null
  offers: { name: string } | null
}

function formatLatency(started: string, completed: string | null) {
  if (!completed) return '—'
  const ms = new Date(completed).getTime() - new Date(started).getTime()
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`
}

function formatCost(c: string | number | null) {
  if (c === null || c === undefined) return '—'
  const n = typeof c === 'string' ? Number(c) : c
  return `$${n.toFixed(4)}`
}

function statusColors(status: string): { dot: string; text: string } {
  const s = status.toLowerCase()
  if (['completed', 'succeeded', 'success', 'done'].includes(s))
    return { dot: '#F5C518', text: '#F5C518' }
  if (['failed', 'error', 'dlq', 'cancelled'].includes(s))
    return { dot: '#8A5048', text: '#C97A6E' }
  return { dot: '#6E6E6C', text: '#8A8A88' }
}

const GRID = 'minmax(0,1.4fr) 110px 90px 90px 120px'

export function AiRunsTable({ rows }: { rows: AdminAiRunRow[] }) {
  if (rows.length === 0) {
    return <p style={{ fontSize: '14px', color: 'var(--muted-foreground)' }}>No AI runs yet.</p>
  }

  return (
    <div>
      <div
        dir="rtl"
        style={{
          display: 'grid',
          gridTemplateColumns: GRID,
          gap: '16px',
          padding: '12px',
          fontFamily: 'var(--font-mono)',
          fontSize: '9.5px',
          letterSpacing: '0.1em',
          color: '#5E5E5C',
          borderBottom: '1px solid rgba(255,255,255,0.09)',
        }}
      >
        <span>ORCHESTRATOR</span>
        <span>STATUS</span>
        <span dir="ltr" style={{ textAlign: 'right' }}>COST</span>
        <span dir="ltr" style={{ textAlign: 'right' }}>LATENCY</span>
        <span dir="ltr" style={{ textAlign: 'right' }}>WHEN</span>
      </div>

      {rows.map((r) => {
        const sc = statusColors(r.status)
        const meta = [r.offers?.name, r.profiles?.email].filter(Boolean).join(' · ')
        return (
          <Link
            key={r.id}
            href={`/admin/ai-runs/${r.id}`}
            className="affex-trow"
            dir="rtl"
            style={{
              display: 'grid',
              gridTemplateColumns: GRID,
              gap: '16px',
              padding: '14px 12px',
              borderBottom: '1px solid rgba(255,255,255,0.06)',
              alignItems: 'center',
              textDecoration: 'none',
              color: 'inherit',
            }}
          >
            <div style={{ minWidth: 0 }}>
              <div dir="ltr" style={{ fontFamily: 'var(--font-mono)', fontSize: '12.5px', color: '#E4E4E2', textAlign: 'right' }}>
                {r.orchestrator_name}
              </div>
              {meta && (
                <div dir="ltr" style={{ fontFamily: 'var(--font-mono)', fontSize: '10.5px', color: '#6E6E6C', textAlign: 'right', marginTop: '3px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {meta}
                </div>
              )}
            </div>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', fontSize: '12px', color: sc.text }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: sc.dot }} />
              {r.status}
            </span>
            <span dir="ltr" style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: '#C9C9C7', textAlign: 'right' }}>
              {formatCost(r.estimated_cost)}
            </span>
            <span dir="ltr" style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: '#8A8A88', textAlign: 'right' }}>
              {formatLatency(r.started_at, r.completed_at)}
            </span>
            <span dir="ltr" style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: '#7A7A78', textAlign: 'right' }}>
              {new Date(r.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </Link>
        )
      })}
    </div>
  )
}
