import { KillSwitchToggle } from '@/components/admin/KillSwitchToggle'
import { createClient } from '@/lib/supabase/server'

export default async function KillSwitchesPage() {
  const supabase = await createClient()
  const { data } = await supabase
    .from('agent_kill_switches')
    .select('orchestrator_name, is_paused, reason, paused_at')
    .order('orchestrator_name')

  const rows = data ?? []

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Kill switches</h1>
        <p className="text-sm text-[var(--color-muted-foreground)]">
          Per-orchestrator emergency stop. Pausing immediately blocks new runs
          (edge fns return 503 before opening an ai_runs row).
        </p>
      </div>

      <div className="flex flex-col gap-3">
        {rows.map((row) => (
          <KillSwitchToggle key={row.orchestrator_name} row={row} />
        ))}
      </div>
    </div>
  )
}
