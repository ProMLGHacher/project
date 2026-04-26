import { type HTMLAttributes } from 'react'
import { cn } from '../utils'

export interface AlertProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'success' | 'warning' | 'destructive' | 'info'
}

const alertVariants: Record<NonNullable<AlertProps['variant']>, string> = {
  default: 'border-border/80',
  success: 'border-success/40 bg-success/10',
  warning: 'border-warning/45 bg-warning/10',
  destructive: 'border-destructive/45 bg-destructive/10',
  info: 'border-info/40 bg-info/10'
}

export function Alert({ className, variant = 'default', ...props }: AlertProps) {
  return (
    <div
      role="status"
      className={cn(
        'rounded-3xl border bg-surface-elevated p-4 text-surface-foreground backdrop-blur-xl',
        alertVariants[variant],
        className
      )}
      {...props}
    />
  )
}

export function AlertTitle({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3 className={cn('font-display text-lg font-bold tracking-tight', className)} {...props} />
  )
}

export function AlertDescription({ className, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p className={cn('mt-1 text-sm leading-snug text-muted-foreground', className)} {...props} />
  )
}

export function Progress({
  className,
  value = 0,
  max = 100,
  ...props
}: HTMLAttributes<HTMLDivElement> & { value?: number; max?: number }) {
  const percent = Math.max(0, Math.min(100, (value / max) * 100))
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
      className={cn('h-2.5 overflow-hidden rounded-full bg-muted', className)}
      {...props}
    >
      <span className="block h-full rounded-full bg-primary" style={{ width: `${percent}%` }} />
    </div>
  )
}

export function Toast({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      role="status"
      className={cn(
        'rounded-3xl border border-border/80 bg-surface-elevated p-4 text-surface-foreground shadow-md backdrop-blur-xl',
        className
      )}
      {...props}
    />
  )
}

export function ToastViewport({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'fixed bottom-4 left-4 right-4 z-50 grid gap-3 sm:left-auto sm:w-96',
        className
      )}
      {...props}
    />
  )
}

export const Sonner = ToastViewport
