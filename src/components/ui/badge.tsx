import * as React from 'react'

import { cn } from '@/lib/utils'

function Badge({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-none border border-[var(--color-border)] bg-[var(--color-muted)] px-2 py-0.5 text-xs font-medium text-[var(--color-foreground)]',
        className
      )}
      {...props}
    />
  )
}

export { Badge }
