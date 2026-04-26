import { type ElementType, type HTMLAttributes, type ReactNode } from 'react'
import { cn } from '../utils'

type PolymorphicProps<TElement extends ElementType> = {
  as?: TElement
  className?: string
  children?: ReactNode
} & Omit<React.ComponentPropsWithoutRef<TElement>, 'as' | 'className' | 'children'>

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <section
      className={cn(
        'rounded-3xl border border-border/80 bg-surface-elevated text-surface-foreground shadow-sm backdrop-blur-xl',
        className
      )}
      {...props}
    />
  )
}

export function CardHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('border-b border-border/80 p-5 sm:p-6', className)} {...props} />
}

export function CardTitle({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3 className={cn('font-display text-xl font-bold tracking-tight', className)} {...props} />
  )
}

export function CardDescription({ className, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn('mt-1 text-sm leading-6 text-muted-foreground', className)} {...props} />
}

export function CardContent({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('p-5 sm:p-6', className)} {...props} />
}

export function CardFooter({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <footer className={cn('border-t border-border/80 p-5 sm:p-6', className)} {...props} />
}

export function Sidebar({ className, ...props }: HTMLAttributes<HTMLElement>) {
  return (
    <aside
      className={cn(
        'min-w-64 rounded-3xl border border-border/80 bg-surface-elevated p-4 shadow-sm backdrop-blur-xl',
        className
      )}
      {...props}
    />
  )
}

export function ScrollArea({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('overflow-auto', className)} {...props} />
}

export function Resizable({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('resize overflow-auto', className)} {...props} />
}

export function Separator({ className, ...props }: HTMLAttributes<HTMLHRElement>) {
  return <hr className={cn('border-0 border-t border-border', className)} {...props} />
}

export function Item<TElement extends ElementType = 'div'>({
  as,
  className,
  ...props
}: PolymorphicProps<TElement>) {
  const Component = as ?? 'div'
  return (
    <Component
      className={cn('flex items-center gap-3 rounded-lg p-3 transition hover:bg-muted', className)}
      {...props}
    />
  )
}
