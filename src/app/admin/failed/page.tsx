import { ReplayButton } from '@/components/admin/ReplayButton'
import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { createClient } from '@/lib/supabase/server'

export default async function FailedMessagesPage() {
  const supabase = await createClient()
  const { data } = await supabase
    .from('failed_messages')
    .select(
      'id, message_type, payload, attempts, max_attempts, last_error, status, created_at'
    )
    .order('created_at', { ascending: false })
    .limit(100)
  const rows = data ?? []

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Failed messages (DLQ)</h1>
        <p className="text-sm text-[var(--color-muted-foreground)]">
          Dead-lettered work. Replaying an <code>ai_run</code> re-invokes the
          orchestrator with its original payload.
        </p>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-[var(--color-muted-foreground)]">
          No failed messages. 🎉
        </p>
      ) : (
        rows.map((m) => {
          const payload = (m.payload ?? {}) as {
            kind?: string
            offer_id?: string
          }
          const replayable =
            m.status !== 'succeeded' &&
            m.message_type === 'ai_run' &&
            payload.kind === 'analyze-offer' &&
            !!payload.offer_id
          return (
            <Card key={m.id}>
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <CardTitle className="text-base">
                    {m.message_type}
                    {payload.kind ? ` · ${payload.kind}` : ''}
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <Badge>{m.status}</Badge>
                    <ReplayButton id={m.id} replayable={replayable} />
                  </div>
                </div>
                <p className="text-xs text-[var(--color-muted-foreground)]">
                  attempt {m.attempts}/{m.max_attempts} ·{' '}
                  {new Date(m.created_at).toLocaleString()}
                  {payload.offer_id ? ` · offer ${payload.offer_id.slice(0, 8)}…` : ''}
                </p>
              </CardHeader>
              {m.last_error && (
                <CardContent>
                  <p className="text-sm text-red-600">{m.last_error}</p>
                </CardContent>
              )}
            </Card>
          )
        })
      )}
    </div>
  )
}
