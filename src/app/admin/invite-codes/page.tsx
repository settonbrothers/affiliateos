import { getTranslations } from 'next-intl/server'

import { GenerateInviteForm } from '@/components/admin/GenerateInviteForm'
import { RevokeInviteButton } from '@/components/admin/RevokeInviteButton'
import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { createClient } from '@/lib/supabase/server'

type CodeRow = {
  id: string
  code: string
  bonus_credits: number
  max_uses: number
  uses: number
  expires_at: string | null
  revoked: boolean
  created_at: string
}

export default async function InviteCodesPage() {
  const supabase = await createClient()
  const { data } = await supabase
    .from('invite_codes')
    .select(
      'id, code, bonus_credits, max_uses, uses, expires_at, revoked, created_at'
    )
    .order('created_at', { ascending: false })
    .returns<CodeRow[]>()

  const rows = data ?? []
  const now = Date.now()
  const t = await getTranslations('discoveryAdmin')

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">{t('inviteTitle')}</h1>
        <p className="text-sm text-[var(--color-muted-foreground)]">
          {t('inviteSubtitle')}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('generateCode')}</CardTitle>
        </CardHeader>
        <CardContent>
          <GenerateInviteForm />
        </CardContent>
      </Card>

      {rows.length === 0 ? (
        <p className="text-sm text-[var(--color-muted-foreground)]">
          {t('inviteEmpty')}
        </p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--color-border)] text-start">
              <th className="py-2 font-medium">{t('colCode')}</th>
              <th className="py-2 font-medium">{t('colBonus')}</th>
              <th className="py-2 font-medium">{t('colUses')}</th>
              <th className="py-2 font-medium">{t('colStatus')}</th>
              <th className="py-2"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => {
              const expired = !!c.expires_at && new Date(c.expires_at).getTime() < now
              const used = c.uses >= c.max_uses
              const status = c.revoked
                ? 'revoked'
                : expired
                  ? 'expired'
                  : used
                    ? 'used up'
                    : 'active'
              return (
                <tr key={c.id} className="border-b border-[var(--color-border)]">
                  <td className="py-2 font-mono">{c.code}</td>
                  <td className="py-2 text-[var(--color-muted-foreground)]">
                    {c.bonus_credits}
                  </td>
                  <td className="py-2 text-[var(--color-muted-foreground)]">
                    {c.uses}/{c.max_uses}
                  </td>
                  <td className="py-2">
                    <Badge>{status}</Badge>
                  </td>
                  <td className="py-2 text-right">
                    {status === 'active' && <RevokeInviteButton id={c.id} />}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </div>
  )
}
