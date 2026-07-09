import { Skeleton } from '@/components/ui/Skeleton'

export default function Loading() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
      <Skeleton width={90} height={12} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Skeleton width="min(460px, 70vw)" height={40} />
        <Skeleton width={260} height={13} />
      </div>
      <div style={{ display: 'flex', gap: 18, borderBottom: '1px solid var(--border)', paddingBottom: 14 }}>
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} width={78} height={14} />
        ))}
      </div>
      <div style={{ display: 'grid', gap: 16 }}>
        <Skeleton height={120} radius={6} />
        <Skeleton height={200} radius={6} />
      </div>
    </div>
  )
}
