import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import type { TestKitResponse } from '@/types/agents/testKit'

function Section({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-[var(--color-muted-foreground)]">
        {title}
      </h3>
      {children}
    </div>
  )
}

export function TestKitView({ payload }: { payload: unknown }) {
  // jsonb arrives untyped; the orchestrator validated it against the Zod
  // contract before storing, so the cast is sound.
  const env = payload as TestKitResponse | null
  const p = env?.payload
  if (!p) {
    return (
      <p className="text-sm text-red-600">
        Test kit payload is malformed — regenerate it.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <Section title="Objective">
        <p className="text-sm">{p.test_objective}</p>
      </Section>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="p-4 pb-1">
            <CardTitle className="text-sm">Channel</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-1 p-4 pt-0 text-sm">
            <div className="flex gap-2">
              <Badge>{p.channel_plan.primary}</Badge>
              {p.channel_plan.secondary && (
                <Badge>{p.channel_plan.secondary}</Badge>
              )}
            </div>
            <p className="text-xs text-[var(--color-muted-foreground)]">
              {p.channel_plan.reasoning}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="p-4 pb-1">
            <CardTitle className="text-sm">Budget (USD)</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-1 p-4 pt-0 text-sm">
            <p>
              min ${p.budget_plan.minimum_usd} · rec $
              {p.budget_plan.recommended_usd} · max $
              {p.budget_plan.max_initial_usd}
            </p>
            <p className="text-xs text-[var(--color-muted-foreground)]">
              {p.budget_plan.reasoning}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="p-4 pb-1">
            <CardTitle className="text-sm">GEO</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-1 p-4 pt-0 text-sm">
            <p>{p.geo_plan.primary.join(', ')}</p>
            {p.geo_plan.secondary && p.geo_plan.secondary.length > 0 && (
              <p className="text-xs text-[var(--color-muted-foreground)]">
                also: {p.geo_plan.secondary.join(', ')}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <Section title="Audience">
        <p className="text-sm">{p.audience_direction}</p>
      </Section>

      <Section title={`Angles (${p.angles.length})`}>
        <div className="grid gap-3 sm:grid-cols-3">
          {p.angles.map((a, i) => (
            <Card key={a.name + '-' + i}>
              <CardHeader className="p-4 pb-1">
                <CardTitle className="text-sm">
                  {i}. {a.name}
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-1 p-4 pt-0 text-sm">
                <p>{a.positioning}</p>
                <p className="text-xs text-[var(--color-muted-foreground)]">
                  {a.target_audience}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </Section>

      <Section title={`Hooks (${p.hooks.length})`}>
        <ul className="flex flex-col gap-1.5 text-sm">
          {p.hooks.map((h, i) => (
            <li key={h.text.slice(0, 20) + '-' + i} className="flex items-baseline gap-2">
              <Badge>#{h.angle_index}</Badge>
              <span>{h.text}</span>
              <span className="text-xs text-[var(--color-muted-foreground)]">
                {h.format}
              </span>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Ad copy">
        <div className="grid gap-3 sm:grid-cols-3">
          {p.ad_copy_variants.map((v, i) => (
            <Card key={v.headline.slice(0, 20) + '-' + i}>
              <CardHeader className="p-4 pb-1">
                <CardTitle className="text-sm">{v.headline}</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-2 p-4 pt-0 text-sm">
                <p>{v.body}</p>
                <Badge>{v.cta}</Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      </Section>

      <Section title="Landing page">
        <div className="flex flex-col gap-1 text-sm">
          <p>
            <span className="font-medium">Above fold:</span>{' '}
            {p.landing_structure.above_fold}
          </p>
          <p>
            <span className="font-medium">Argument:</span>{' '}
            {p.landing_structure.main_argument}
          </p>
          <p>
            <span className="font-medium">Proof:</span>{' '}
            {p.landing_structure.proof_elements.join(' · ')}
          </p>
          <p>
            <span className="font-medium">CTA:</span> {p.landing_structure.cta}
          </p>
        </div>
      </Section>

      <div className="grid gap-4 sm:grid-cols-2">
        <Section title="KPI targets">
          <p className="text-sm">
            CTR {p.kpi_targets.ctr_target}% · CPC ${p.kpi_targets.cpc_target} ·
            CVR {p.kpi_targets.cvr_target}% · EPC ${p.kpi_targets.epc_target}
          </p>
          <p className="text-xs text-[var(--color-muted-foreground)]">
            Primary KPI: {p.tracking_plan.primary_kpi}
          </p>
        </Section>
        <Section title="Kill / scale criteria">
          <ul className="list-disc pl-5 text-sm">
            {p.kill_criteria.map((c, i) => (
              <li key={`k${i}`} className="text-red-700">
                {c}
              </li>
            ))}
            {p.scale_criteria.map((c, i) => (
              <li key={`s${i}`} className="text-green-700">
                {c}
              </li>
            ))}
          </ul>
        </Section>
      </div>

      {p.compliance_warnings.length > 0 && (
        <div className="rounded-md border border-yellow-600/50 bg-yellow-50 p-3 text-sm dark:bg-yellow-950/40">
          <p className="font-medium">Compliance</p>
          <ul className="mt-1 list-disc pl-5">
            {p.compliance_warnings.map((w, i) => (
              <li key={w.slice(0, 20) + '-' + i}>{w}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
