import { cn } from '@/lib/utils'

export function Badge({
  className,
  children
}: React.PropsWithChildren<{ className?: string }>) {
  return (
    <span className={cn('inline-flex items-center rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground', className)}>
      {children}
    </span>
  )
}
