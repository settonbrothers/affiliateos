/**
 * Admin page header per the mock: a big Latin-uppercase Oswald title (English,
 * since Oswald has no Hebrew glyphs) with a Hebrew/translated subtitle beneath.
 */
export function AdminPageHeader({
  title,
  subtitle,
}: {
  title: string
  subtitle?: string
}) {
  return (
    <div style={{ marginBottom: '24px' }}>
      <h1
        dir="ltr"
        style={{
          margin: 0,
          fontFamily: 'var(--font-display)',
          fontSize: 'clamp(28px,4vw,44px)',
          fontWeight: 600,
          letterSpacing: '0.02em',
          textTransform: 'uppercase',
        }}
      >
        {title}
      </h1>
      {subtitle && (
        <p style={{ margin: '8px 0 0', fontSize: '13.5px', color: 'var(--muted-foreground)', maxWidth: '62ch' }}>
          {subtitle}
        </p>
      )}
    </div>
  )
}
