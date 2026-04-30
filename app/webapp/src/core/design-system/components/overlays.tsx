import { useEffect, type ButtonHTMLAttributes, type HTMLAttributes, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '../utils'

export function Dialog({
  open,
  className,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement> & { open?: boolean }) {
  useEffect(() => {
    if (!open) return
    const originalDocumentOverflow = document.documentElement.style.overflow
    const originalOverflow = document.body.style.overflow
    document.documentElement.style.overflow = 'hidden'
    document.body.style.overflow = 'hidden'

    return () => {
      document.documentElement.style.overflow = originalDocumentOverflow
      document.body.style.overflow = originalOverflow
    }
  }, [open])

  if (!open) return null
  return (
    <div
      className="fixed inset-0 z-50 grid items-start overflow-y-auto overscroll-contain bg-slate-950/56 p-3 backdrop-blur-md sm:place-items-center sm:p-4"
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          'my-3 w-full max-w-lg rounded-3xl border border-border/80 bg-surface-elevated p-5 text-surface-foreground shadow-lg backdrop-blur-xl sm:my-0 sm:p-6',
          className
        )}
        {...props}
      >
        {children}
      </div>
    </div>
  )
}

export function AlertDialog(props: React.ComponentPropsWithoutRef<typeof Dialog>) {
  return <Dialog {...props} role="alertdialog" />
}

export function DialogHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <header className={cn('mb-4', className)} {...props} />
}

export function DialogFooter({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <footer
      className={cn('mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end', className)}
      {...props}
    />
  )
}

export interface DrawerProps extends HTMLAttributes<HTMLDivElement> {
  open?: boolean
  side?: 'left' | 'right' | 'top' | 'bottom'
}

export function Drawer({ open, side = 'right', className, ...props }: DrawerProps) {
  if (!open) return null
  const sideClass = {
    left: 'left-0 top-0 h-full w-full max-w-md',
    right: 'right-0 top-0 h-full w-full max-w-md',
    top: 'left-0 top-0 min-h-56 w-full',
    bottom: 'bottom-0 left-0 min-h-56 w-full'
  }[side]

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/56 backdrop-blur-md" role="presentation">
      <aside
        className={cn(
          'fixed border border-border/80 bg-surface-elevated p-5 shadow-lg backdrop-blur-xl',
          sideClass,
          className
        )}
        {...props}
      />
    </div>
  )
}

export const Sheet = Drawer

export function Popover({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'w-full max-w-sm rounded-xl border border-border bg-surface p-3 shadow-md',
        className
      )}
      {...props}
    />
  )
}

export function HoverCard({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('rounded-xl border border-border bg-surface p-4 shadow-md', className)}
      {...props}
    />
  )
}

export function Tooltip({ className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      role="tooltip"
      className={cn('rounded-md bg-foreground px-2 py-1 text-xs text-background', className)}
      {...props}
    />
  )
}

export function DropdownMenu({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      role="menu"
      className={cn(
        'grid gap-1 rounded-xl border border-border bg-surface p-2 shadow-md',
        className
      )}
      {...props}
    />
  )
}

export const ContextMenu = DropdownMenu

export type ContextMenuPosition = {
  readonly x: number
  readonly y: number
}

export function ContextMenuRoot({
  children,
  onClose,
  open
}: {
  readonly children: ReactNode
  readonly onClose: () => void
  readonly open: boolean
}) {
  useEffect(() => {
    if (!open) {
      return
    }

    const close = () => onClose()
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    window.addEventListener('pointerdown', close)
    window.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('pointerdown', close)
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('resize', close)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [onClose, open])

  if (!open || typeof document === 'undefined') {
    return null
  }

  return createPortal(children, document.body)
}

export function ContextMenuContent({
  className,
  position,
  ...props
}: HTMLAttributes<HTMLDivElement> & {
  readonly position: ContextMenuPosition
}) {
  return (
    <div
      role="menu"
      className={cn(
        'fixed z-50 grid min-w-44 gap-1 rounded-lg border border-border bg-surface p-2 text-foreground shadow-lg',
        className
      )}
      style={{
        left: Math.max(8, Math.min(position.x, window.innerWidth - 220)),
        top: Math.max(8, Math.min(position.y, window.innerHeight - 240))
      }}
      onPointerDown={(event) => event.stopPropagation()}
      {...props}
    />
  )
}

export function ContextMenuItem({
  className,
  destructive = false,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  readonly destructive?: boolean
}) {
  return (
    <button
      role="menuitem"
      className={cn(
        'flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-muted',
        destructive && 'text-destructive hover:bg-destructive/10',
        className
      )}
      type="button"
      {...props}
    />
  )
}

export function ContextMenuSeparator({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('my-1 h-px bg-border', className)} {...props} />
}

export function ContextMenuReactionBar({
  className,
  onReaction,
  reactions
}: {
  readonly className?: string
  readonly onReaction: (reaction: string) => void
  readonly reactions: readonly string[]
}) {
  return (
    <div className={cn('flex items-center gap-1 px-1 py-1', className)}>
      {reactions.map((reaction) => (
        <button
          key={reaction}
          className="grid size-8 place-items-center rounded-md text-base transition-colors hover:bg-muted"
          type="button"
          onClick={() => onReaction(reaction)}
        >
          {reaction}
        </button>
      ))}
    </div>
  )
}

export function MenuItem({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      role="menuitem"
      className={cn(
        'flex cursor-default items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-muted',
        className
      )}
      {...props}
    />
  )
}
