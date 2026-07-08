'use client'

import { useId } from 'react'

/**
 * AFFEX symbol mark — a yellow square with a black "A" (Oswald 700) sliced by a
 * diagonal "crack" (skewX -16°). The crack is the brand's signature motif
 * (echoing the Crack Score). Geometry taken from the AFFEX Logo Guidelines.
 *
 * Variants:
 *  - `primary`   — yellow square + ink A + ink crack (default; use on light or dark)
 *  - `mono-white`— knockout A (crack removed) in white, no square (dark backgrounds)
 *  - `mono-ink`  — knockout A (crack removed) in ink, no square (light backgrounds)
 *
 * Below ~20px the crack is dropped (illegible), per the guidelines' 16px minimum.
 */
export type AffexMarkVariant = 'primary' | 'mono-white' | 'mono-ink'

interface AffexMarkProps {
  size?: number
  variant?: AffexMarkVariant
  className?: string
  title?: string
}

const INK = '#0A0A0A'
const GIALLO = '#F5C518'

export function AffexMark({
  size = 32,
  variant = 'primary',
  className,
  title = 'AFFEX',
}: AffexMarkProps) {
  const maskId = useId()
  const showCrack = size >= 20

  const letter = (fill: string, mask?: string) => (
    <text
      x="50"
      y="78"
      textAnchor="middle"
      fontSize={76}
      fill={fill}
      mask={mask}
      style={{ fontFamily: 'var(--font-display), sans-serif', fontWeight: 700 }}
    >
      A
    </text>
  )

  const crackRect = (fill: string) => (
    <rect x="64" y="-2" width="6.5" height="104" fill={fill} transform="skewX(-16)" />
  )

  if (variant === 'primary') {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 100 100"
        role="img"
        aria-label={title}
        className={className}
      >
        <rect width="100" height="100" fill={GIALLO} />
        {letter(INK)}
        {showCrack && crackRect(INK)}
      </svg>
    )
  }

  // Mono: single-color A with the crack knocked OUT (shows the background through
  // the slice), so it works on any surface.
  const color = variant === 'mono-white' ? '#FFFFFF' : INK
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      role="img"
      aria-label={title}
      className={className}
    >
      {showCrack && (
        <defs>
          <mask id={maskId}>
            <rect width="100" height="100" fill="white" />
            {crackRect('black')}
          </mask>
        </defs>
      )}
      {letter(color, showCrack ? `url(#${maskId})` : undefined)}
    </svg>
  )
}
