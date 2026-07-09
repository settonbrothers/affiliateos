import { Skeleton } from '@/components/ui/Skeleton'

export default function Loading() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '24px', flexWrap: 'wrap', marginBottom: 'clamp(24px,3vw,38px)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Skeleton width={180} height={11} />
          <Skeleton width="min(380px, 60vw)" height={52} />
          <Skeleton width={220} height={12} />
        </div>
        <Skeleton width={150} height={44} radius={0} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {Array.from({ length: 7 }).map((_, i) => (
          <Skeleton key={i} height={72} />
        ))}
      </div>
    </div>
  )
}
