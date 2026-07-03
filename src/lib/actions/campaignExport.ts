'use server'

import { getCampaignViewData } from '@/lib/queries/campaignView'

function section(title: string, content: unknown): string {
  if (content === null || content === undefined) return ''
  const lines: string[] = [`\n${'='.repeat(60)}`, `  ${title}`, `${'='.repeat(60)}`]
  if (typeof content === 'string') {
    lines.push(content)
  } else if (Array.isArray(content)) {
    content.forEach((item, i) => lines.push(`${i + 1}. ${String(item)}`))
  } else if (typeof content === 'object') {
    for (const [key, val] of Object.entries(content as Record<string, unknown>)) {
      if (val === null || val === undefined) continue
      const label = key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
      if (Array.isArray(val)) {
        lines.push(`\n${label}:`)
        val.forEach((item) => lines.push(`  - ${String(item)}`))
      } else if (typeof val === 'object') {
        lines.push(`\n${label}:`)
        for (const [k2, v2] of Object.entries(val as Record<string, unknown>)) {
          lines.push(`  ${k2}: ${String(v2)}`)
        }
      } else {
        lines.push(`${label}: ${String(val)}`)
      }
    }
  }
  return lines.join('\n')
}

export async function exportCampaignData(
  offerId: string
): Promise<{ data: string; filename: string } | { error: string }> {
  try {
    const d = await getCampaignViewData(offerId)

    const parts: string[] = [
      `CAMPAIGN EXPORT`,
      `Offer ID: ${offerId}`,
      `Exported: ${new Date().toISOString()}`,
    ]

    if (d.deepBrief) parts.push(section('DEEP BRIEF', d.deepBrief))
    if (d.avatar) parts.push(section('AVATAR', d.avatar))
    if (d.spyInsights) parts.push(section('SPY INSIGHTS', d.spyInsights))

    if (d.adCopy) {
      const copy = d.adCopy as Record<string, unknown>
      // Extract ad copy variants if nested under a known key
      const variants =
        (copy.variants as unknown[] | undefined) ??
        (copy.ads as unknown[] | undefined) ??
        (copy.copies as unknown[] | undefined)
      if (variants) {
        parts.push(section('AD COPY VARIANTS', variants))
      } else {
        parts.push(section('AD COPY', d.adCopy))
      }
    }

    if (d.creatives) {
      const creatives = d.creatives as Record<string, unknown>
      // Collect image URLs
      const imageUrls: string[] = []
      function collectUrls(obj: unknown) {
        if (!obj || typeof obj !== 'object') return
        for (const val of Object.values(obj as Record<string, unknown>)) {
          if (typeof val === 'string' && (val.startsWith('http://') || val.startsWith('https://'))) {
            imageUrls.push(val)
          } else if (Array.isArray(val)) {
            val.forEach(collectUrls)
          } else if (typeof val === 'object') {
            collectUrls(val)
          }
        }
      }
      collectUrls(creatives)

      parts.push(section('CREATIVES', d.creatives))

      if (imageUrls.length > 0) {
        parts.push(`\n${'='.repeat(60)}`)
        parts.push('  IMAGE URLs (download individually)')
        parts.push('='.repeat(60))
        imageUrls.forEach((url, i) => parts.push(`${i + 1}. ${url}`))
      }
    }

    const text = parts.join('\n')
    return { data: text, filename: `campaign-export-${offerId}.txt` }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return { error: message }
  }
}
