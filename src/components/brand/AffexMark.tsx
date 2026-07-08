'use client'

import { useId } from 'react'

/**
 * AFFEX symbol mark — a yellow square with a heavy geometric "A" sliced by a
 * diagonal "crack" (skewX -16°). The A is a vector PATH (not live text) so the
 * mark renders identically everywhere regardless of font loading. The crack is
 * the brand's signature motif (echoing the Crack Score). Geometry per the AFFEX
 * Logo Guidelines.
 *
 * Variants:
 *  - `primary`   — yellow square + ink A + ink crack (default; light or dark)
 *  - `mono-white`— knockout A (crack removed) in white, no square (dark bg)
 *  - `mono-ink`  — knockout A (crack removed) in ink, no square (light bg)
 *
 * Below ~20px the crack is dropped (illegible), per the 16px minimum.
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

// Heavy geometric "A": outer silhouette + counter hole (evenodd).
const A_PATH = 'M50,12 L86,88 L64,88 L58,70 L42,70 L36,88 L14,88 Z M50,33 L58,58 L42,58 Z'

export function AffexMark({
  size = 32,
  variant = 'primary',
  className,
  title = 'AFFEX',
}: AffexMarkProps) {
  const maskId = useId()
  const showCrack = size >= 20

  const crack = (fill: string) => (
    <rect x="74" y="-2" width="7.5" height="104" fill={fill} transform="skewX(-16)" />
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
        <path d={A_PATH} fill={INK} fillRule="evenodd" />
        {showCrack && crack(INK)}
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
            {crack('black')}
          </mask>
        </defs>
      )}
      <path
        d={A_PATH}
        fill={color}
        fillRule="evenodd"
        mask={showCrack ? `url(#${maskId})` : undefined}
      />
    </svg>
  )
}
