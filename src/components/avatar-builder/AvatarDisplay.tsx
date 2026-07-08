import { EditorialCard } from '@/components/brand/editorial/EditorialCard'
import { EditorialSlab } from '@/components/brand/editorial/EditorialSlab'
import type { AvatarBuilderPayload } from '@/types/agents/avatarBuilder'

function ListCard({ title, items }: { title: string; items: string[] }) {
  return (
    <EditorialCard title={title}>
      <ul style={{ margin: 0, paddingInlineStart: '18px', listStyle: 'disc', display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {items.map((item, i) => (
          <li key={item + '-' + i}>{item}</li>
        ))}
      </ul>
    </EditorialCard>
  )
}

export function AvatarDisplay({ payload }: { payload: unknown }) {
  const p = payload as AvatarBuilderPayload | null
  if (!p) {
    return (
      <p style={{ fontSize: '14px', color: '#B23A24' }}>
        Avatar payload is malformed — re-run the generation.
      </p>
    )
  }

  const topCards: [string, string][] = [
    ['מצב חיים', p.life_situation],
    ['הטרנספורמציה', p.transformation],
    ['הטריגר הרגשי', p.emotional_trigger],
  ]

  return (
    <div className="flex flex-col gap-5" dir="rtl">
      <EditorialSlab label="WHO · מי הלקוח">
        <p
          style={{
            margin: 0,
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(18px,2.4vw,26px)',
            fontWeight: 500,
            lineHeight: 1.25,
          }}
        >
          {p.who}
        </p>
      </EditorialSlab>

      <div className="grid gap-3 sm:grid-cols-2">
        {topCards.map(([title, val]) => (
          <EditorialCard key={title} title={title}>
            {val}
          </EditorialCard>
        ))}
      </div>

      <ListCard title="נקודות כאב" items={p.pain_points ?? []} />
      <ListCard title="התנגדויות" items={p.objections ?? []} />
      <ListCard title="רצונות" items={p.desires ?? []} />
      <ListCard title="קול הלקוח" items={p.voice_of_customer ?? []} />
      <ListCard title="אותות אמון" items={p.trust_signals ?? []} />
    </div>
  )
}
