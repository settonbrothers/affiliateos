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
      const blob = new Blob([result.data], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `campaign-bundle-${offerId}.json`
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 100)
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleExport}
      disabled={loading}
      className="rounded-md bg-[var(--color-foreground)] px-4 py-2 text-sm font-medium text-[var(--color-background)] disabled:opacity-50"
    >
      {loading ? 'מוריד...' : 'הורד Campaign Bundle'}
    </button>
  )
}
