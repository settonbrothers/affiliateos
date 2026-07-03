import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import type { DeepBriefPayload } from '@/types/agents/deepBrief'

export function DeepBriefDisplay({ payload }: { payload: unknown }) {
  const p = payload as DeepBriefPayload | null
  if (!p) {
    return (
      <p className="text-sm text-red-600">
        Deep brief payload is malformed — re-run the generation.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      {p.search_summary && (
        <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-muted)] p-3 text-sm text-[var(--color-muted-foreground)]">
          <span className="font-medium text-[var(--color-foreground)]">Research summary: </span>
          {p.search_summary}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader className="p-4 pb-1">
            <CardTitle className="text-sm">What we sell</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 text-sm">{p.what_we_sell}</CardContent>
        </Card>

        <Card>
          <CardHeader className="p-4 pb-1">
            <CardTitle className="text-sm">Main differentiator</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 text-sm">{p.main_differentiator}</CardContent>
        </Card>

        <Card>
          <CardHeader className="p-4 pb-1">
            <CardTitle className="text-sm">Timing — why now?</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 text-sm">{p.timing}</CardContent>
        </Card>

        <Card>
          <CardHeader className="p-4 pb-1">
            <CardTitle className="text-sm">Emotional connection</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 text-sm">{p.emotional_connection}</CardContent>
        </Card>

        <Card>
          <CardHeader className="p-4 pb-1">
            <CardTitle className="text-sm">What normal state means</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 text-sm">{p.normal_state_meaning}</CardContent>
        </Card>

        <Card>
          <CardHeader className="p-4 pb-1">
            <CardTitle className="text-sm">Control in hands</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 text-sm">{p.control_in_hands}</CardContent>
        </Card>

        <Card>
          <CardHeader className="p-4 pb-1">
            <CardTitle className="text-sm">Real confidence</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 text-sm">{p.real_confidence}</CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="p-4 pb-1">
          <CardTitle className="text-sm">Must-know facts</CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          <ul className="list-disc pl-4 text-sm text-[var(--color-muted-foreground)]">
            {(p.must_know ?? []).map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {(p.proofs ?? []).length > 0 && (
        <Card>
          <CardHeader className="p-4 pb-1">
            <CardTitle className="text-sm">Proofs</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <ul className="list-disc pl-4 text-sm text-[var(--color-muted-foreground)]">
              {(p.proofs ?? []).map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="p-4 pb-1">
          <CardTitle className="text-sm">Crack Post Parameters</CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          <div className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <p className="font-medium">Problem / Pain</p>
              <p className="text-[var(--color-muted-foreground)]">{p.crack_post_params.problem_pain}</p>
            </div>
            <div>
              <p className="font-medium">Solution</p>
              <p className="text-[var(--color-muted-foreground)]">{p.crack_post_params.solution}</p>
            </div>
            <div>
              <p className="font-medium">Urgency</p>
              <p className="text-[var(--color-muted-foreground)]">{p.crack_post_params.urgency}</p>
            </div>
            <div>
              <p className="font-medium">Agenda / Proof</p>
              <p className="text-[var(--color-muted-foreground)]">{p.crack_post_params.agenda_proof}</p>
            </div>
            <div>
              <p className="font-medium">Benefit Amplified</p>
              <p className="text-[var(--color-muted-foreground)]">{p.crack_post_params.benefit_amplified}</p>
            </div>
            <div>
              <p className="font-medium">Belief It Will Happen</p>
              <p className="text-[var(--color-muted-foreground)]">{p.crack_post_params.belief_it_will_happen}</p>
            </div>
            <div className="sm:col-span-2">
              <p className="font-medium">CTA</p>
              <p className="text-[var(--color-muted-foreground)]">{p.crack_post_params.cta_placeholder}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
