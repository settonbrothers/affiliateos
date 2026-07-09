import { Skeleton } from '@/components/ui/Skeleton'

export default function Loading() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <Skeleton width={90} height={12} />
      <Skeleton width="min(420px, 70vw)" height={34} />
      <div style={{ display: 'grid', gap: 16 }}>
        <Skeleton height={140} radius={6} />
        <Skeleton height={180} radius={6} />
      </div>
    </div>
  )
}
