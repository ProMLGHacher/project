import { cn } from '../utils'

export type ButtonVariant = 'default' | 'secondary' | 'outline' | 'ghost' | 'destructive'
export type ButtonSize = 'sm' | 'md' | 'lg' | 'icon'

export interface ButtonStyleOptions {
  variant?: ButtonVariant
  size?: ButtonSize
  className?: string
}

const buttonVariantClasses: Record<ButtonVariant, string> = {
  default:
    'border-primary/20 bg-primary text-primary-foreground shadow-sm shadow-primary/25 hover:bg-primary-hover hover:shadow-md hover:shadow-primary/30',
  secondary:
    'border-transparent bg-accent text-accent-foreground hover:bg-accent/80 hover:text-foreground',
  outline:
    'border-border/80 bg-surface-overlay text-foreground backdrop-blur-sm hover:bg-surface-elevated',
  ghost: 'border-transparent bg-transparent text-foreground hover:bg-muted/80',
  destructive:
    'border-destructive/20 bg-destructive text-on-feedback shadow-sm shadow-destructive/20 hover:opacity-90'
}

const buttonSizeClasses: Record<ButtonSize, string> = {
  sm: 'min-h-9 px-3.5 text-sm',
  md: 'min-h-11 px-4.5 text-sm',
  lg: 'min-h-13 px-6 text-base',
  icon: 'size-11 p-0'
}

export function buttonClassName({
  variant = 'default',
  size = 'md',
  className
}: ButtonStyleOptions = {}) {
  return cn(
    'inline-flex items-center justify-center gap-2 rounded-2xl border font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50',
    buttonVariantClasses[variant],
    buttonSizeClasses[size],
    className
  )
}
