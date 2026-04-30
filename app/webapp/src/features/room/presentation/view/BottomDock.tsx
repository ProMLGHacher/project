import type { ReactNode } from 'react'
import type { TFunction } from 'i18next'
import { Card, CardContent, cn } from '@core/design-system'
import { CameraIcon, CameraOffIcon, LeaveIcon, MicIcon, MicOffIcon, ScreenIcon } from './room-icons'

type VoiceT = TFunction<'voice'>

export interface BottomDockProps {
  readonly microphoneEnabled: boolean
  readonly cameraEnabled: boolean
  readonly screenEnabled: boolean
  readonly onMicrophone: () => void
  readonly onCamera: () => void
  readonly onScreen: () => void
  readonly onLeave: () => void
  readonly t: VoiceT
}

export function BottomDock({
  microphoneEnabled,
  cameraEnabled,
  screenEnabled,
  onMicrophone,
  onCamera,
  onScreen,
  onLeave,
  t
}: BottomDockProps) {
  return (
    <Card className="animate-panel-in rounded-full border-border bg-surface text-foreground shadow-2xl">
      <CardContent className="flex items-center justify-center gap-2 p-2">
        <DockButton
          active={microphoneEnabled}
          activeIcon={<MicIcon />}
          inactiveIcon={<MicOffIcon />}
          label={microphoneEnabled ? t('room.controls.mute') : t('room.controls.unmute')}
          onClick={onMicrophone}
        />
        <DockButton
          active={cameraEnabled}
          activeIcon={<CameraIcon />}
          inactiveIcon={<CameraOffIcon />}
          label={cameraEnabled ? t('room.controls.cameraOff') : t('room.controls.cameraOn')}
          onClick={onCamera}
        />
        <DockButton
          active={screenEnabled}
          activeIcon={<ScreenIcon />}
          inactiveIcon={<ScreenIcon />}
          label={screenEnabled ? t('room.controls.stopShare') : t('room.controls.shareScreen')}
          onClick={onScreen}
          variant={screenEnabled ? 'activeShare' : 'neutral'}
        />
        <DockButton
          active
          activeIcon={<LeaveIcon />}
          inactiveIcon={<LeaveIcon />}
          label={t('room.header.leave')}
          onClick={onLeave}
          variant="danger"
        />
      </CardContent>
    </Card>
  )
}

function DockButton({
  active,
  activeIcon,
  inactiveIcon,
  label,
  onClick,
  variant = 'media'
}: {
  readonly active: boolean
  readonly activeIcon: ReactNode
  readonly inactiveIcon: ReactNode
  readonly label: string
  readonly onClick: () => void
  readonly variant?: 'media' | 'neutral' | 'activeShare' | 'danger'
}) {
  return (
    <button
      aria-label={label}
      className={cn(
        'inline-flex size-12 items-center justify-center rounded-full text-foreground transition duration-200 hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:size-13',
        variant === 'danger' || (!active && variant === 'media')
          ? 'bg-destructive text-on-feedback shadow-lg shadow-destructive/25 hover:opacity-95'
          : variant === 'activeShare'
            ? 'bg-info text-on-feedback shadow-lg shadow-info/25'
            : 'bg-muted hover:bg-accent'
      )}
      onClick={onClick}
      title={label}
      type="button"
    >
      {active ? activeIcon : inactiveIcon}
    </button>
  )
}
