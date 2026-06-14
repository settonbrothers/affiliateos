import { setSourceEnabled } from '@/lib/actions/discovery'
import { listDiscoverySources } from '@/lib/queries/discovery'

export default async function DiscoverySourcesPage() {
  const sources = await listDiscoverySources()

  async function toggle(formData: FormData) {
    'use server'
    const id = String(formData.get('id'))
    const enabled = formData.get('enabled') === 'true'
    await setSourceEnabled(id, !enabled)
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Discovery sources</h1>
      <p className="text-sm text-[var(--color-muted-foreground)]">
        Enabled web-search sources are queried on every scan for their vertical.
      </p>

      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[var(--color-border)] text-left">
            <th className="py-2 font-medium">Name</th>
            <th className="py-2 font-medium">Kind</th>
            <th className="py-2 font-medium">Queries</th>
            <th className="py-2 font-medium">Enabled</th>
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
                    {s.enabled ? 'Disable' : 'Enable'}
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
                No sources yet. Migration 0030 seeds one web-search source per
                vertical.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
