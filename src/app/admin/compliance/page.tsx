import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { createClient } from '@/lib/supabase/server'

type RuleRow = {
  id: string
  rule_type: string
  title: string
  detail: string
  severity: string
  channel: string | null
  verticals: { slug: string; name: string } | null
}

export default async function CompliancePage() {
  const supabase = await createClient()
  const { data } = await supabase
    .from('compliance_rules')
    .select('id, rule_type, title, detail, severity, channel, verticals(slug, name)')
    .order('severity', { ascending: false })
    .returns<RuleRow[]>()

  const rows = data ?? []
  const byVertical = new Map<string, RuleRow[]>()
  for (const r of rows) {
    const key = r.verticals?.name ?? 'All verticals'
    const arr = byVertical.get(key) ?? []
    arr.push(r)
    byVertical.set(key, arr)
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Compliance rules</h1>
        <p className="text-sm text-[var(--color-muted-foreground)]">
          Reference rules per vertical. The ComplianceCheckOrchestrator enforces
          the operative guidance; these are the human-readable policy set.
        </p>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-[var(--color-muted-foreground)]">
          No compliance rules seeded.
        </p>
      ) : (
        [...byVertical.entries()].map(([vertical, rules]) => (
          <Card key={vertical}>
            <CardHeader>
              <CardTitle className="text-base">{vertical}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {rules.map((r) => (
                <div key={r.id} className="flex flex-col gap-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{r.title}</span>
                    <Badge>{r.severity}</Badge>
                    <span className="text-xs text-[var(--color-muted-foreground)]">
                      {r.rule_type}
                    </span>
                  </div>
                  <p className="text-sm text-[var(--color-muted-foreground)]">
                    {r.detail}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>
        ))
      )}
    </div>
  )
}
