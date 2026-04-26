import { forwardRef, type HTMLAttributes, type ReactNode, type VideoHTMLAttributes } from 'react'
import { cn } from '../utils'

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'secondary' | 'success' | 'warning' | 'destructive' | 'info'
}

const badgeVariants: Record<NonNullable<BadgeProps['variant']>, string> = {
  default: 'bg-muted/85 text-muted-foreground',
  secondary: 'bg-accent text-accent-foreground',
  success: 'bg-success text-on-feedback',
  warning: 'bg-warning text-slate-950',
  destructive: 'bg-destructive text-on-feedback',
  info: 'bg-info text-on-feedback'
}

export function Badge({ className, variant = 'default', ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex w-fit items-center rounded-full border border-transparent px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide',
        badgeVariants[variant],
        className
      )}
      {...props}
    />
  )
}

export interface AvatarProps extends HTMLAttributes<HTMLDivElement> {
  src?: string
  alt?: string
  fallback?: ReactNode
}

export function Avatar({ className, src, alt = '', fallback, ...props }: AvatarProps) {
  return (
    <div
      className={cn(
        'inline-grid size-10 place-items-center overflow-hidden rounded-full border border-white/10 bg-muted font-bold text-muted-foreground shadow-sm',
        className
      )}
      {...props}
    >
      {src ? <img src={src} alt={alt} className="size-full object-cover" /> : fallback}
    </div>
  )
}

export function AspectRatio({
  ratio = 16 / 9,
  className,
  style,
  ...props
}: HTMLAttributes<HTMLDivElement> & { ratio?: number }) {
  return (
    <div
      className={cn('w-full overflow-hidden rounded-xl bg-muted', className)}
      style={{ ...style, aspectRatio: String(ratio) }}
      {...props}
    />
  )
}

export function Kbd({ className, ...props }: HTMLAttributes<HTMLElement>) {
  return (
    <kbd
      className={cn(
        'rounded-md border border-border bg-muted px-1.5 py-0.5 font-mono text-xs text-muted-foreground',
        className
      )}
      {...props}
    />
  )
}

export function Empty({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'grid min-h-48 place-items-center rounded-3xl border border-dashed border-border/80 bg-surface-elevated p-8 text-center text-muted-foreground backdrop-blur-xl',
        className
      )}
      {...props}
    />
  )
}

export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('animate-pulse rounded-md bg-muted', className)} {...props} />
}

export function Spinner({ className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      role="status"
      aria-live="polite"
      className={cn(
        'inline-block size-4 animate-spin rounded-full border-2 border-muted border-t-primary',
        className
      )}
      {...props}
    />
  )
}

export const VideoAspectRatio = forwardRef<HTMLVideoElement, VideoHTMLAttributes<HTMLVideoElement>>(
  ({ className, ...props }, ref) => (
    <video
      ref={ref}
      className={cn('w-full overflow-hidden rounded-xl bg-muted', className)}
      {...props}
    />
  )
)
VideoAspectRatio.displayName = 'VideoAspectRatio'
