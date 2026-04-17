import type { PropsWithChildren, ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface ModalProps extends PropsWithChildren {
  open: boolean
  title: string
  description?: string
  footer?: ReactNode
  className?: string
}

export function Modal({ open, title, description, footer, className, children }: ModalProps) {
  if (!open) {
    return null
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4">
      <div className={cn('w-full max-w-3xl rounded-[28px] border border-border/70 bg-card shadow-2xl', className)}>
        <div className="border-b border-border/60 px-6 py-5">
          <h2 className="font-display text-2xl font-semibold">{title}</h2>
          {description ? <p className="mt-2 text-sm text-muted-foreground">{description}</p> : null}
        </div>
        <div className="p-6">{children}</div>
        {footer ? <div className="flex items-center justify-end gap-3 border-t border-border/60 px-6 py-5">{footer}</div> : null}
      </div>
    </div>
  )
}
