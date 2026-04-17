import { Camera, Copy, Mic, MonitorUp, PhoneOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface ControlBarProps {
  micEnabled: boolean
  cameraEnabled: boolean
  screenEnabled: boolean
  onMicToggle: () => void
  onCameraToggle: () => void
  onScreenToggle: () => void
  onCopyLink: () => void
}

export function ControlBar({
  micEnabled,
  cameraEnabled,
  screenEnabled,
  onMicToggle,
  onCameraToggle,
  onScreenToggle,
  onCopyLink
}: ControlBarProps) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-3 rounded-[28px] border border-border/60 bg-card/90 p-3 shadow-xl backdrop-blur">
      <ControlButton active={micEnabled} label={micEnabled ? 'Mic live' : 'Mic muted'} onClick={onMicToggle}>
        <Mic className="h-4 w-4" />
      </ControlButton>
      <ControlButton active={cameraEnabled} label={cameraEnabled ? 'Camera on' : 'Camera off'} onClick={onCameraToggle}>
        <Camera className="h-4 w-4" />
      </ControlButton>
      <ControlButton active={screenEnabled} label={screenEnabled ? 'Sharing screen' : 'Share screen'} onClick={onScreenToggle}>
        <MonitorUp className="h-4 w-4" />
      </ControlButton>
      <Button type="button" variant="outline" className="rounded-2xl" onClick={onCopyLink}>
        <Copy className="mr-2 h-4 w-4" />
        Copy link
      </Button>
      <Button variant="ghost" className="rounded-2xl text-destructive">
        <PhoneOff className="mr-2 h-4 w-4" />
        Leave
      </Button>
    </div>
  )
}

function ControlButton({
  active,
  label,
  onClick,
  children
}: React.PropsWithChildren<{ active: boolean; label: string; onClick: () => void }>) {
  return (
    <Button
      type="button"
      variant={active ? 'default' : 'outline'}
      size="lg"
      className={cn('min-w-36 rounded-2xl', !active && 'text-slate-700')}
      onClick={onClick}
    >
      <span className="mr-2">{children}</span>
      {label}
    </Button>
  )
}
