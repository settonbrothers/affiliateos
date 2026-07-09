import { Skeleton } from '@/components/ui/Skeleton'

export default function Loading() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      <div style={{ marginBottom: 'clamp(24px,3vw,38px)' }}>
        <Skeleton width={150} height={11} style={{ marginBottom: 14 }} />
        <Skeleton width="min(440px, 70%)" height={46} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} height={64} />
        ))}
      </div>
    </div>
  )
}
