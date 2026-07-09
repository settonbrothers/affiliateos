import type { CSSProperties } from 'react'

// A single shimmering placeholder block used by route-level loading.tsx files.
// Server component (no client JS); relies on the .affex-skel class in globals.css.
export function Skeleton({
  width = '100%',
  height = 16,
  radius = 3,
  style,
}: {
  width?: number | string
  height?: number | string
  radius?: number | string
  style?: CSSProperties
}) {
  return (
    <span
      aria-hidden
      className="affex-skel"
      style={{ width, height, borderRadius: radius, ...style }}
    />
  )
}
