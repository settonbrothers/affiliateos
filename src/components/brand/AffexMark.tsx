/**
 * AFFEX symbol mark — "The Spark Notch". A Giallo square with a heavy Oswald 700
 * "A" sliced by the brand's signature diagonal crack (skewX -16°), echoing the
 * Crack Score. Built as HTML (not a hand-authored path) so the "A" is the real
 * Oswald glyph, exactly per the AFFEX Logo Guidelines:
 *   tile square · A = 0.65 of the tile · crack full-height, right 32.6%, width 5.4%.
 */
const INK = '#0A0A0A'
const GIALLO = '#F5C518'

interface AffexMarkProps {
  size?: number
  className?: string
  title?: string
}

export function AffexMark({
  size = 32,
  className,
  title = 'AFFEX',
}: AffexMarkProps) {
  return (
    <span
      role="img"
      aria-label={title}
      className={className}
      style={{
        position: 'relative',
        display: 'inline-flex',
        width: size,
        height: size,
        flexShrink: 0,
        background: GIALLO,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
      }}
    >
      <span
        aria-hidden
        style={{
          fontFamily: 'var(--font-display)',
          fontWeight: 700,
          fontSize: size * 0.65,
          lineHeight: 1,
          color: INK,
        }}
      >
        A
      </span>
      <span
        aria-hidden
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          right: '32.6%',
          width: '5.4%',
          background: INK,
          transform: 'skewX(-16deg)',
        }}
      />
    </span>
  )
}
