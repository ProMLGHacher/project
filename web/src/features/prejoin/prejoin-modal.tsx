import { useMemo, useState } from 'react'
import { Camera, Mic, UserRound, Video } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'
import { Switch } from '@/components/ui/switch'

interface PrejoinModalProps {
  open: boolean
  loading?: boolean
  onJoin: (payload: { displayName: string; micEnabled: boolean; cameraEnabled: boolean }) => Promise<void> | void
}

export function PrejoinModal({ open, loading, onJoin }: PrejoinModalProps) {
  const [displayName, setDisplayName] = useState('')
  const [micEnabled, setMicEnabled] = useState(true)
  const [cameraEnabled, setCameraEnabled] = useState(false)

  const previewLabel = useMemo(() => {
    if (cameraEnabled && micEnabled) {
      return 'Camera preview is on. Audio will join live.'
    }
    if (cameraEnabled) {
      return 'Camera preview is on. Microphone starts muted.'
    }
    return 'Audio-first entry. Camera can be added later without dropping voice.'
  }, [cameraEnabled, micEnabled])

  return (
    <Modal
      open={open}
      title="Check your setup before joining"
      description="Voice is the priority path. You can come in mic-only and add camera or screen share after the room is already live."
      footer={
        <Button
          onClick={() => onJoin({ displayName, micEnabled, cameraEnabled })}
          disabled={!displayName.trim() || loading}
        >
          {loading ? 'Joining…' : 'Join room'}
        </Button>
      }
    >
      <div className="grid gap-6 md:grid-cols-[1.2fr,0.8fr]">
        <div className="overflow-hidden rounded-[24px] border border-border/60 bg-slate-950 p-4 text-slate-50">
          <div className="flex h-64 items-center justify-center rounded-[18px] border border-white/10 bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.24),_transparent_42%),linear-gradient(180deg,_rgba(15,23,42,0.94),_rgba(2,6,23,0.98))]">
            <div className="text-center">
              <Video className="mx-auto mb-3 h-10 w-10 text-emerald-300" />
              <p className="max-w-xs text-sm text-slate-200">{previewLabel}</p>
            </div>
          </div>
        </div>

        <div className="space-y-5">
          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-700">Display name</span>
            <div className="relative">
              <UserRound className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="How people will see you"
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
              />
            </div>
          </label>

          <div className="space-y-4 rounded-2xl border border-border/60 bg-muted/40 p-4">
            <ToggleRow
              title="Microphone"
              description="Audio sender stays alive and we switch actual mute with track.enabled."
              icon={<Mic className="h-4 w-4" />}
              checked={micEnabled}
              onCheckedChange={setMicEnabled}
            />
            <ToggleRow
              title="Camera"
              description="Camera starts on its own reserved slot so you can add it later without replacing the room session."
              icon={<Camera className="h-4 w-4" />}
              checked={cameraEnabled}
              onCheckedChange={setCameraEnabled}
            />
          </div>
        </div>
      </div>
    </Modal>
  )
}

function ToggleRow({
  title,
  description,
  icon,
  checked,
  onCheckedChange
}: {
  title: string
  description: string
  icon: React.ReactNode
  checked: boolean
  onCheckedChange: (checked: boolean) => void
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <div className="flex items-center gap-2 text-sm font-medium">
          {icon}
          {title}
        </div>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  )
}
