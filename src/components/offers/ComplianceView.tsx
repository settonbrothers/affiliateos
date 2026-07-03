import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import type { ComplianceResponse } from '@/types/agents/compliance'
import { cn } from '@/lib/utils'

const RISK_CLASS: Record<string, string> = {
  low: 'border-green-300 bg-green-100 text-green-800',
  medium: 'border-amber-300 bg-amber-100 text-amber-800',
  high: 'border-orange-300 bg-orange-100 text-orange-900',
  critical: 'border-red-300 bg-red-100 text-red-800',
}

export function ComplianceView({
  payload,
  suggestedVerdictCap,
}: {
  payload: unknown
  suggestedVerdictCap?: string | null
}) {
  const env = payload as ComplianceResponse | null
  const p = env?.payload
  if (!p) {
    return (
      <p className="text-sm text-red-600">
        Compliance payload is malformed — re-run the check.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-2">
        <Badge className={RISK_CLASS[p.overall_risk_level]}>
          risk: {p.overall_risk_level}
        </Badge>
        <Badge>score: {p.compliance_score}/100</Badge>
        <Badge>paid traffic: {p.paid_traffic_recommendation}</Badge>
      </div>

      {suggestedVerdictCap && (
        <div className="rounded-md border border-red-300 bg-red-50 p-3 text-sm dark:bg-red-950/40">
          <p className="font-medium">
            Verdict capped to “{suggestedVerdictCap}” by compliance
          </p>
          <p className="text-[var(--color-muted-foreground)]">
            Health/wellness offer with elevated compliance risk — do not exceed
            this verdict until the flagged claims are cleared.
          </p>
        </div>
      )}

      {p.detected_claims.length > 0 ? (
        <div className="flex flex-col gap-3">
          {p.detected_claims.map((c, i) => (
            <Card key={c.claim_type + '-' + i}>
              <CardHeader className="p-4 pb-1">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-sm">{c.claim_type}</CardTitle>
                  <Badge className={RISK_CLASS[c.risk_level]}>
                    {c.risk_level}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="flex flex-col gap-1 p-4 pt-0 text-sm">
                <p className="italic">“{c.claim_text}”</p>
                <p className="text-xs text-[var(--color-muted-foreground)]">
                  {c.why_risky}
                </p>
                <p className="text-green-700">
                  <span className="font-medium">Safe:</span> {c.safe_framing}
                </p>
                <p className="text-red-700">
                  <span className="font-medium">Avoid:</span>{' '}
                  {c.forbidden_framing}
                </p>
                {c.requires_disclaimer && (
                  <span className="text-xs text-[var(--color-muted-foreground)]">
                    Requires a disclaimer.
                  </span>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <p className="text-sm text-[var(--color-muted-foreground)]">
          No risky claims detected.
        </p>
      )}

      {(p.platform_risks.length > 0 ||
        p.geo_risks.length > 0 ||
        p.required_disclaimers.length > 0) && (
        <div className={cn('grid gap-3 text-sm sm:grid-cols-3')}>
          {p.platform_risks.length > 0 && (
            <div>
              <h4 className="font-medium">Platform risks</h4>
              <p className="text-[var(--color-muted-foreground)]">
                {p.platform_risks.join(', ')}
              </p>
            </div>
          )}
          {p.geo_risks.length > 0 && (
            <div>
              <h4 className="font-medium">GEO risks</h4>
              <p className="text-[var(--color-muted-foreground)]">
                {p.geo_risks.join(', ')}
              </p>
            </div>
          )}
          {p.required_disclaimers.length > 0 && (
            <div>
              <h4 className="font-medium">Required disclaimers</h4>
              <ul className="list-disc pl-4 text-[var(--color-muted-foreground)]">
                {p.required_disclaimers.map((d, i) => (
                  <li key={d + '-' + i}>{d}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
