import { EditorialCard } from '@/components/brand/editorial/EditorialCard'
import type { SpyAnalysisResponse } from '@/types/agents/spyAnalysis'

const STYLE_LABELS: Record<SpyAnalysisResponse['style'], string> = {
  emotional: 'רגשי',
  technical: 'טכני',
  story: 'סיפור',
  testimonial: 'המלצות',
  data: 'נתונים',
  mixed: 'מעורב',
}

const STRENGTH_COLORS: Record<
  SpyAnalysisResponse['hook_analysis']['hook_strength'],
  { bg: string; fg: string }
> = {
  strong: { bg: '#DCF0DC', fg: '#2E6B34' },
  medium: { bg: '#FBEFC9', fg: '#8A6D16' },
  weak: { bg: '#F6D9D2', fg: '#B23A24' },
}

const STRENGTH_LABELS: Record<SpyAnalysisResponse['hook_analysis']['hook_strength'], string> = {
  strong: 'חזק',
  medium: 'בינוני',
  weak: 'חלש',
}

function ListCard({ title, items, color }: { title: string; items: string[]; color?: string }) {
  return (
    <EditorialCard title={title}>
      <ul style={{ margin: 0, paddingInlineStart: '18px', listStyle: 'disc', display: 'flex', flexDirection: 'column', gap: '4px', color: color ?? '#1F1B16' }}>
        {items.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ul>
    </EditorialCard>
  )
}

export function SpyAnalysisDisplay({ payload }: { payload: unknown }) {
  const p = payload as SpyAnalysisResponse | null
  if (!p) {
    return (
      <p style={{ fontSize: '14px', color: '#B23A24' }}>
        Spy analysis payload is malformed — re-run the analysis.
      </p>
    )
  }

  const strength = STRENGTH_COLORS[p.hook_analysis.hook_strength]

  return (
    <div className="flex flex-col gap-5" dir="rtl">
      <EditorialCard title="מה ראינו">{p.input_summary}</EditorialCard>

      <EditorialCard title="ניתוח הוק">
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span style={{ fontSize: '12px', color: '#8A8375' }}>סוג:</span>
            <span style={{ fontSize: '14px', fontWeight: 500 }}>{p.hook_analysis.hook_type}</span>
            <span
              style={{
                borderRadius: '0',
                padding: '2px 10px',
                fontSize: '12px',
                fontWeight: 500,
                background: strength.bg,
                color: strength.fg,
              }}
            >
              {STRENGTH_LABELS[p.hook_analysis.hook_strength]}
            </span>
          </div>
          {p.hook_analysis.hooks_found.length > 0 && (
            <ul style={{ margin: 0, paddingInlineStart: '18px', listStyle: 'disc', display: 'flex', flexDirection: 'column', gap: '4px', color: '#6B6459' }}>
              {p.hook_analysis.hooks_found.map((hook, i) => (
                <li key={i}>{hook}</li>
              ))}
            </ul>
          )}
        </div>
      </EditorialCard>

      <div className="grid gap-3 sm:grid-cols-2">
        <EditorialCard title="ניתוח הגוף">{p.meat_analysis}</EditorialCard>
        <EditorialCard title="ניתוח CTA">{p.cta_analysis}</EditorialCard>
        <EditorialCard title="מבנה Template">{p.template_structure}</EditorialCard>
        <EditorialCard title="סגנון דומיננטי">
          <span
            style={{
              display: 'inline-block',
              borderRadius: '0',
              padding: '4px 12px',
              fontSize: '13px',
              fontWeight: 500,
              background: '#EFEBE1',
              color: '#1F1B16',
            }}
          >
            {STYLE_LABELS[p.style]}
          </span>
        </EditorialCard>
      </div>

      {p.psychological_triggers.length > 0 && (
        <ListCard title="טריגרים פסיכולוגיים" items={p.psychological_triggers} color="#6B6459" />
      )}
      {p.winning_elements.length > 0 && (
        <ListCard title="מה נראה מנצח" items={p.winning_elements} color="#2E6B34" />
      )}
      {p.what_not_to_copy.length > 0 && (
        <ListCard title="מה לא לעשות" items={p.what_not_to_copy} color="#B23A24" />
      )}
      {p.gaps_opportunities.length > 0 && (
        <ListCard title="הזדמנויות" items={p.gaps_opportunities} color="#2E6B34" />
      )}
    </div>
  )
}
