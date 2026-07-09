import { Skeleton } from '@/components/ui/Skeleton'

export default function Loading() {
  return (
    <div className="flex flex-col gap-6">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <Skeleton width={220} height={26} />
        <Skeleton width={320} height={13} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8 }}>
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} height={40} />
        ))}
      </div>
    </div>
  )
}
