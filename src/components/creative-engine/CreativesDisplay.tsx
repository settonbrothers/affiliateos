import type { CreativeItem } from '@/types/agents/creativeEngine'

function CreativeCard({ creative, index }: { creative: CreativeItem; index: number }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', border: '1px solid #DED8CB', background: '#FFFFFF', overflow: 'hidden' }}>
      <div style={{ position: 'relative', aspectRatio: '1 / 1', width: '100%', background: '#EFEBE1' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={creative.image_url}
          alt={creative.type_label}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          loading="lazy"
        />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', padding: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
          <div>
            <p style={{ margin: 0, fontSize: '11px', color: '#8A8375' }}>Creative {index + 1}</p>
            <h3 dir="rtl" style={{ margin: 0, fontSize: '14px', fontWeight: 500, color: '#1F1B16' }}>
              {creative.type_label}
            </h3>
          </div>
          <a
            href={creative.image_url}
            download={`creative-${index + 1}.png`}
            target="_blank"
            rel="noopener noreferrer"
            style={{ flexShrink: 0, fontSize: '12px', color: '#9A6B00', textDecoration: 'underline' }}
          >
            Download
          </a>
        </div>
        <p style={{ margin: 0, fontSize: '12px', color: '#6B6459', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
          {creative.rationale}
        </p>
      </div>
    </div>
  )
}

export function CreativesDisplay({ payload }: { payload: unknown }) {
  const data = payload as { creatives?: CreativeItem[] }
  const creatives = data?.creatives ?? []

  if (creatives.length === 0) {
    return <p style={{ fontSize: '14px', color: '#6B6459' }}>No creatives found in this result.</p>
  }

  return (
    <div className="flex flex-col gap-4">
      <p style={{ fontSize: '14px', color: '#6B6459' }}>
        {creatives.length} ad creatives generated. Images are valid for 1 hour from generation.
      </p>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {creatives.map((creative, i) => (
          <CreativeCard key={creative.type} creative={creative} index={i} />
        ))}
      </div>
    </div>
  )
}
