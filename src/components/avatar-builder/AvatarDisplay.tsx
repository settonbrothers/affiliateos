import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import type { AvatarBuilderPayload } from '@/types/agents/avatarBuilder'

export function AvatarDisplay({ payload }: { payload: unknown }) {
  const p = payload as AvatarBuilderPayload | null
  if (!p) {
    return (
      <p className="text-sm text-red-600">
        Avatar payload is malformed — re-run the generation.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader className="p-4 pb-1">
            <CardTitle className="text-sm">מי הלקוח</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 text-sm">{p.who}</CardContent>
        </Card>

        <Card>
          <CardHeader className="p-4 pb-1">
            <CardTitle className="text-sm">מצב חיים</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 text-sm">{p.life_situation}</CardContent>
        </Card>

        <Card>
          <CardHeader className="p-4 pb-1">
            <CardTitle className="text-sm">הטרנספורמציה</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 text-sm">{p.transformation}</CardContent>
        </Card>

        <Card>
          <CardHeader className="p-4 pb-1">
            <CardTitle className="text-sm">הטריגר הרגשי</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 text-sm">{p.emotional_trigger}</CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="p-4 pb-1">
          <CardTitle className="text-sm">נקודות כאב</CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          <ul className="list-disc pl-4 text-sm text-[var(--color-muted-foreground)]">
            {(p.pain_points ?? []).map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="p-4 pb-1">
          <CardTitle className="text-sm">התנגדויות</CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          <ul className="list-disc pl-4 text-sm text-[var(--color-muted-foreground)]">
            {(p.objections ?? []).map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="p-4 pb-1">
          <CardTitle className="text-sm">רצונות</CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          <ul className="list-disc pl-4 text-sm text-[var(--color-muted-foreground)]">
            {(p.desires ?? []).map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="p-4 pb-1">
          <CardTitle className="text-sm">קול הלקוח</CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          <ul className="list-disc pl-4 text-sm text-[var(--color-muted-foreground)]">
            {(p.voice_of_customer ?? []).map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="p-4 pb-1">
          <CardTitle className="text-sm">אותות אמון</CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          <ul className="list-disc pl-4 text-sm text-[var(--color-muted-foreground)]">
            {(p.trust_signals ?? []).map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}
