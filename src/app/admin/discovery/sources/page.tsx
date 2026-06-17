import { getTranslations } from 'next-intl/server'

import { setSourceEnabled } from '@/lib/actions/discovery'
import { listDiscoverySources } from '@/lib/queries/discovery'

export default async function DiscoverySourcesPage() {
  const sources = await listDiscoverySources()
  const t = await getTranslations('discoveryAdmin')

  async function toggle(formData: FormData) {
    'use server'
    const id = String(formData.get('id'))
    const enabled = formData.get('enabled') === 'true'
    await setSourceEnabled(id, !enabled)
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">{t('sourcesTitle')}</h1>
      <p className="text-sm text-[var(--color-muted-foreground)]">
        {t('sourcesSubtitle')}
      </p>

      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[var(--color-border)] text-start">
            <th className="py-2 font-medium">{t('colSourceName')}</th>
            <th className="py-2 font-medium">{t('colKind')}</th>
            <th className="py-2 font-medium">{t('colQueries')}</th>
            <th className="py-2 font-medium">{t('colEnabled')}</th>
          </tr>
        </thead>
        <tbody>
          {sources.map((s) => (
            <tr key={s.id} className="border-b border-[var(--color-border)]">
              <td className="py-2">{s.name}</td>
              <td className="py-2 text-[var(--color-muted-foreground)]">
                {s.kind}
              </td>
              <td className="py-2 text-[var(--color-muted-foreground)]">
                {(s.config?.query_templates ?? []).length}
              </td>
              <td className="py-2">
                <form action={toggle}>
                  <input type="hidden" name="id" value={s.id} />
                  <input
                    type="hidden"
                    name="enabled"
                    value={String(s.enabled)}
                  />
                  <button
                    type="submit"
                    className="rounded-md border border-[var(--color-border)] px-2 py-1 text-xs"
                  >
                    {s.enabled ? t('disable') : t('enable')}
                  </button>
                </form>
              </td>
            </tr>
          ))}
          {sources.length === 0 && (
            <tr>
              <td
                colSpan={4}
                className="py-3 text-[var(--color-muted-foreground)]"
              >
                {t('noSources')}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
