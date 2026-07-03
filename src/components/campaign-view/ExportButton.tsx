'use client'

import { useState } from 'react'

import { exportCampaignData } from '@/lib/actions/campaignExport'

export function ExportButton({ offerId }: { offerId: string }) {
  const [loading, setLoading] = useState(false)
  const [pdfLoading, setPdfLoading] = useState(false)

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

  async function handlePdfExport() {
    setPdfLoading(true)
    try {
      const result = await exportCampaignData(offerId)
      if ('error' in result) {
        alert(`Export failed: ${result.error}`)
        return
      }
      const content = result.data.replace(/</g, '&lt;').replace(/>/g, '&gt;')
      const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Campaign Export</title>
<style>body{font-family:sans-serif;padding:2rem;direction:rtl}pre{white-space:pre-wrap;font-family:inherit}</style>
</head>
<body><pre>${content}</pre><script>window.print()<\/script></body>
</html>`
      const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      window.open(url, '_blank')
      setTimeout(() => URL.revokeObjectURL(url), 10_000)
    } finally {
      setPdfLoading(false)
    }
  }

  return (
    <div className="flex flex-wrap gap-3">
      <button
        onClick={handleExport}
        disabled={loading}
        className="rounded-md bg-[var(--color-foreground)] px-4 py-2 text-sm font-medium text-[var(--color-background)] disabled:opacity-50"
      >
        {loading ? 'מוריד...' : 'הורד Campaign Export'}
      </button>
      <button
        onClick={handlePdfExport}
        disabled={pdfLoading}
        className="rounded-md border border-[var(--color-border)] px-4 py-2 text-sm font-medium text-[var(--color-foreground)] disabled:opacity-50"
      >
        {pdfLoading ? 'מכין PDF...' : 'ייצוא PDF'}
      </button>
    </div>
  )
}
