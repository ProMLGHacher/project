import type { ReactNode } from 'react'
import { cn } from '@core/design-system'

export function IconButton({
  active = false,
  children,
  label,
  onClick
}: {
  readonly active?: boolean
  readonly children: ReactNode
  readonly label: string
  readonly onClick: () => void
}) {
  return (
    <button
      aria-label={label}
      className={cn(
        'inline-flex size-10 items-center justify-center rounded-full text-foreground transition hover:scale-105 active:scale-100',
        active ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-accent'
      )}
      onClick={onClick}
      title={label}
      type="button"
    >
      {children}
    </button>
  )
}

export function MicIcon() {
  return (
    <svg aria-hidden="true" className="size-5" fill="none" viewBox="0 0 24 24">
      <path
        d="M12 14.5a3.5 3.5 0 0 0 3.5-3.5V7a3.5 3.5 0 0 0-7 0v4a3.5 3.5 0 0 0 3.5 3.5ZM5 11a7 7 0 0 0 14 0M12 18v3M9 21h6"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.8"
      />
    </svg>
  )
}

export function MicOffIcon() {
  return (
    <svg aria-hidden="true" className="size-5" fill="none" viewBox="0 0 24 24">
      <path
        d="m4 4 16 16M9.3 5.1A3.5 3.5 0 0 1 15.5 7v4c0 .55-.13 1.06-.35 1.52M8.5 8.9V11a3.5 3.5 0 0 0 5.15 3.09M5 11a7 7 0 0 0 10.4 6.1M19 11a6.95 6.95 0 0 1-1.1 3.76M12 18v3M9 21h6"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.8"
      />
    </svg>
  )
}

export function CameraIcon() {
  return (
    <svg aria-hidden="true" className="size-5" fill="none" viewBox="0 0 24 24">
      <path
        d="M4.5 8.5A2.5 2.5 0 0 1 7 6h7a2.5 2.5 0 0 1 2.5 2.5v7A2.5 2.5 0 0 1 14 18H7a2.5 2.5 0 0 1-2.5-2.5v-7ZM16.5 10.2l3.6-2.1v7.8l-3.6-2.1"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  )
}

export function CameraOffIcon() {
  return (
    <svg aria-hidden="true" className="size-5" fill="none" viewBox="0 0 24 24">
      <path
        d="m4 4 16 16M5.8 6.55A2.5 2.5 0 0 0 4.5 8.75v6.75A2.5 2.5 0 0 0 7 18h7a2.5 2.5 0 0 0 1.9-.87M9.2 6H14a2.5 2.5 0 0 1 2.5 2.5v5.3M16.5 10.2l3.6-2.1v7.8l-3.6-2.1"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  )
}

export function ScreenIcon() {
  return (
    <svg aria-hidden="true" className="size-5" fill="none" viewBox="0 0 24 24">
      <path
        d="M5 6.5h14A2.5 2.5 0 0 1 21.5 9v7A2.5 2.5 0 0 1 19 18.5H5A2.5 2.5 0 0 1 2.5 16V9A2.5 2.5 0 0 1 5 6.5ZM9 21h6M12 18.5V21M12 15V10M9.5 12.5 12 10l2.5 2.5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  )
}

export function LeaveIcon() {
  return (
    <svg aria-hidden="true" className="size-5" fill="none" viewBox="0 0 24 24">
      <path
        d="M14 7V5.5A2.5 2.5 0 0 0 11.5 3h-5A2.5 2.5 0 0 0 4 5.5v13A2.5 2.5 0 0 0 6.5 21h5A2.5 2.5 0 0 0 14 18.5V17M10 12h10M17 8.5 20.5 12 17 15.5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  )
}

export function CopyIcon() {
  return (
    <svg aria-hidden="true" className="size-5" fill="none" viewBox="0 0 24 24">
      <path
        d="M8 8.5A2.5 2.5 0 0 1 10.5 6h6A2.5 2.5 0 0 1 19 8.5v9A2.5 2.5 0 0 1 16.5 20h-6A2.5 2.5 0 0 1 8 17.5v-9Z"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="M5 15.5v-9A2.5 2.5 0 0 1 7.5 4h6"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.8"
      />
    </svg>
  )
}

export function ParticipantsIcon() {
  return (
    <svg aria-hidden="true" className="size-5" fill="none" viewBox="0 0 24 24">
      <path
        d="M9.5 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM3.5 20a6 6 0 0 1 12 0M16 11.5a3 3 0 1 0 0-6M18 19.5a5 5 0 0 0-2.5-4.33"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.8"
      />
    </svg>
  )
}

export function InfoIcon() {
  return (
    <svg aria-hidden="true" className="size-5" fill="none" viewBox="0 0 24 24">
      <path
        d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 11v5M12 8h.01"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.8"
      />
    </svg>
  )
}

export function CodeIcon() {
  return (
    <svg aria-hidden="true" className="size-5" fill="none" viewBox="0 0 24 24">
      <path
        d="m8 9-3 3 3 3M16 9l3 3-3 3M14 5l-4 14"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  )
}

export function ChatIcon() {
  return (
    <svg aria-hidden="true" className="size-5" fill="none" viewBox="0 0 24 24">
      <path
        d="M5.5 5.5h13A2.5 2.5 0 0 1 21 8v7.5A2.5 2.5 0 0 1 18.5 18H10l-5 3v-3.5A2.5 2.5 0 0 1 3 15V8a2.5 2.5 0 0 1 2.5-2.5Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
      <path d="M8 10h8M8 13.5h5" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
    </svg>
  )
}

export function CloseIcon() {
  return (
    <svg aria-hidden="true" className="size-5" fill="none" viewBox="0 0 24 24">
      <path
        d="m7 7 10 10M17 7 7 17"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.8"
      />
    </svg>
  )
}
