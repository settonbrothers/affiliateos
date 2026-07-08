import type { CSSProperties, ReactNode } from 'react'

/**
 * The warm off-white "Selezione" canvas. Renders dark Oswald content on
 * #F6F4EF. `bleed` adds the negative margins that cancel the app <main>
 * padding for edge-to-edge full-bleed (used inside the (app) layout); omit it
 * on standalone full-screen pages (auth/onboarding).
 */
export function EditorialSurface({
  children,
  bleed = false,
  style,
}: {
  children: ReactNode
  bleed?: boolean
  style?: CSSProperties
}) {
  return (
    <div
      style={{
        background: '#F6F4EF',
        color: '#1F1B16',
        padding: 'clamp(28px,4vw,52px) clamp(24px,4vw,48px)',
        ...(bleed
          ? {
              marginInlineStart: 'calc(-1 * clamp(20px,4vw,64px))',
              marginInlineEnd: 'calc(-1 * clamp(20px,4vw,64px))',
            }
          : {}),
        ...style,
      }}
    >
      {children}
    </div>
  )
}
