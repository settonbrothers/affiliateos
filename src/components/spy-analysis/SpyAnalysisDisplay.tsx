import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import type { SpyAnalysisResponse } from '@/types/agents/spyAnalysis'

const STYLE_LABELS: Record<SpyAnalysisResponse['style'], string> = {
  emotional: 'רגשי',
  technical: 'טכני',
  story: 'סיפור',
  testimonial: 'המלצות',
  data: 'נתונים',
  mixed: 'מעורב',
}

const STRENGTH_COLORS: Record<SpyAnalysisResponse['hook_analysis']['hook_strength'], string> = {
  strong: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
  medium: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300',
  weak: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
}

const STRENGTH_LABELS: Record<SpyAnalysisResponse['hook_analysis']['hook_strength'], string> = {
  strong: 'חזק',
  medium: 'בינוני',
  weak: 'חלש',
}

export function SpyAnalysisDisplay({ payload }: { payload: unknown }) {
  const p = payload as SpyAnalysisResponse | null
  if (!p) {
    return (
      <p className="text-sm text-red-600">
        Spy analysis payload is malformed — re-run the analysis.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-5" dir="rtl">
      {/* מה ראינו */}
      <Card>
        <CardHeader className="p-4 pb-1">
          <CardTitle className="text-sm">מה ראינו</CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0 text-sm">{p.input_summary}</CardContent>
      </Card>

      {/* ניתוח הוק */}
      <Card>
        <CardHeader className="p-4 pb-1">
          <CardTitle className="text-sm">ניתוח הוק</CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0 flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-[var(--color-muted-foreground)]">סוג:</span>
            <span className="text-sm font-medium">{p.hook_analysis.hook_type}</span>
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${STRENGTH_COLORS[p.hook_analysis.hook_strength]}`}
            >
              {STRENGTH_LABELS[p.hook_analysis.hook_strength]}
            </span>
          </div>
          {p.hook_analysis.hooks_found.length > 0 && (
            <ul className="list-disc pr-4 text-sm text-[var(--color-muted-foreground)]">
              {p.hook_analysis.hooks_found.map((hook, i) => (
                <li key={i}>{hook}</li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2">
        {/* ניתוח הגוף */}
        <Card>
          <CardHeader className="p-4 pb-1">
            <CardTitle className="text-sm">ניתוח הגוף</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 text-sm">{p.meat_analysis}</CardContent>
        </Card>

        {/* ניתוח CTA */}
        <Card>
          <CardHeader className="p-4 pb-1">
            <CardTitle className="text-sm">ניתוח CTA</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 text-sm">{p.cta_analysis}</CardContent>
        </Card>

        {/* מבנה template */}
        <Card>
          <CardHeader className="p-4 pb-1">
            <CardTitle className="text-sm">מבנה Template</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 text-sm">{p.template_structure}</CardContent>
        </Card>

        {/* סגנון דומיננטי */}
        <Card>
          <CardHeader className="p-4 pb-1">
            <CardTitle className="text-sm">סגנון דומיננטי</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <span className="rounded-full bg-[var(--color-muted)] px-3 py-1 text-sm font-medium">
              {STYLE_LABELS[p.style]}
            </span>
          </CardContent>
        </Card>
      </div>

      {/* טריגרים פסיכולוגיים */}
      {p.psychological_triggers.length > 0 && (
        <Card>
          <CardHeader className="p-4 pb-1">
            <CardTitle className="text-sm">טריגרים פסיכולוגיים</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <ul className="list-disc pr-4 text-sm text-[var(--color-muted-foreground)]">
              {p.psychological_triggers.map((trigger, i) => (
                <li key={i}>{trigger}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* מה נראה מנצח */}
      {p.winning_elements.length > 0 && (
        <Card>
          <CardHeader className="p-4 pb-1">
            <CardTitle className="text-sm">מה נראה מנצח</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <ul className="list-disc pr-4 text-sm text-[var(--color-muted-foreground)]">
              {p.winning_elements.map((el, i) => (
                <li key={i}>{el}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* מה לא לעשות */}
      {p.what_not_to_copy.length > 0 && (
        <Card className="border-red-200 dark:border-red-900">
          <CardHeader className="p-4 pb-1">
            <CardTitle className="text-sm text-red-700 dark:text-red-400">מה לא לעשות</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <ul className="list-disc pr-4 text-sm text-red-700 dark:text-red-400">
              {p.what_not_to_copy.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* הזדמנויות */}
      {p.gaps_opportunities.length > 0 && (
        <Card className="border-green-200 dark:border-green-900">
          <CardHeader className="p-4 pb-1">
            <CardTitle className="text-sm text-green-700 dark:text-green-400">הזדמנויות</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <ul className="list-disc pr-4 text-sm text-green-700 dark:text-green-400">
              {p.gaps_opportunities.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
