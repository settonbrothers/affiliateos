'use client'

import { useState } from 'react'

import { exportCampaignData } from '@/lib/actions/campaignExport'

export function ExportButton({ offerId }: { offerId: string }) {
  const [loading, setLoading] = useState(false)

  async function handleExport() {
    setLoading(true)
    try {
      const result = await exportCampaignData(offerId)
      if ('error' in result) {
        alert(`Export failed: ${result.error}`)
        return
      }
      const blob = new Blob([result.data], { type: 'text/plain;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = result.filename
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 100)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <button
        onClick={handleExport}
        disabled={loading}
        className="rounded-md bg-[var(--color-foreground)] px-4 py-2 text-sm font-medium text-[var(--color-background)] disabled:opacity-50"
      >
        {loading ? 'מוריד...' : 'הורד Campaign Export'}
      </button>
      <span className="text-xs text-[var(--color-muted-foreground)]">PDF — coming soon</span>
    </div>
  )
}
