import { getTranslations } from 'next-intl/server'

import { AdminPageHeader } from '@/components/admin/AdminPageHeader'
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
      <AdminPageHeader title="KILL SWITCHES" subtitle={t('killSwitchesSubtitle')} />

      <div className="flex flex-col gap-[10px]">
        {rows.map((row) => (
          <KillSwitchToggle key={row.orchestrator_name} row={row} />
        ))}
      </div>
    </div>
  )
}
