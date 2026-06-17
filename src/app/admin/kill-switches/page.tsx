import { getTranslations } from 'next-intl/server'

import { KillSwitchToggle } from '@/components/admin/KillSwitchToggle'
import { createClient } from '@/lib/supabase/server'

export default async function KillSwitchesPage() {
  const supabase = await createClient()
  const { data } = await supabase
    .from('agent_kill_switches')
    .select('orchestrator_name, is_paused, reason, paused_at')
    .order('orchestrator_name')

  const rows = data ?? []
  const t = await getTranslations('discoveryAdmin')

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">{t('killSwitchesTitle')}</h1>
        <p className="text-sm text-[var(--color-muted-foreground)]">
          {t('killSwitchesSubtitle')}
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
