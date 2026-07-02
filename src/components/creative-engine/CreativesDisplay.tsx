import type { CreativeItem } from '@/types/agents/creativeEngine'

function CreativeCard({ creative, index }: { creative: CreativeItem; index: number }) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-[var(--color-border)] overflow-hidden">
      <div className="relative aspect-square w-full bg-[var(--color-muted)]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={creative.image_url}
          alt={creative.type_label}
          className="w-full h-full object-cover"
          loading="lazy"
        />
      </div>
      <div className="flex flex-col gap-1 p-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-xs text-[var(--color-muted-foreground)]">
              Creative {index + 1}
            </p>
            <h3 className="font-medium text-sm" dir="rtl">
              {creative.type_label}
            </h3>
          </div>
          <a
            href={creative.image_url}
            download={`creative-${index + 1}.png`}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 text-xs text-[var(--color-primary)] underline"
          >
            Download
          </a>
        </div>
        <p className="text-xs text-[var(--color-muted-foreground)] line-clamp-3">
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
    return (
      <p className="text-sm text-[var(--color-muted-foreground)]">
        No creatives found in this result.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-[var(--color-muted-foreground)]">
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
