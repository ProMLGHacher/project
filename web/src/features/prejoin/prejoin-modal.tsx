import { useEffect, useMemo, useRef, useState } from 'react'
import { Camera, Mic, UserRound, Video } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'
import { Switch } from '@/components/ui/switch'
import { logInfo, logWarn } from '@/lib/logger'

interface PrejoinModalProps {
  open: boolean
  loading?: boolean
  onJoin: (payload: { displayName: string; micEnabled: boolean; cameraEnabled: boolean }) => Promise<void> | void
}

export function PrejoinModal({ open, loading, onJoin }: PrejoinModalProps) {
  const [displayName, setDisplayName] = useState('')
  const [micEnabled, setMicEnabled] = useState(true)
  const [cameraEnabled, setCameraEnabled] = useState(false)
  const [previewStream, setPreviewStream] = useState<MediaStream | null>(null)
  const [previewStatus, setPreviewStatus] = useState('Microphone is ready. Camera starts off.')
  const [previewError, setPreviewError] = useState<string | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const previewVideoTrackRef = useRef<MediaStreamTrack | null>(null)
  const previewAudioTrackRef = useRef<MediaStreamTrack | null>(null)
  const previewStreamRef = useRef<MediaStream | null>(null)

  const previewLabel = useMemo(() => {
    if (cameraEnabled && micEnabled) {
      return 'Camera preview is on. Audio will join live.'
    }
    if (cameraEnabled) {
      return 'Camera preview is on. Microphone starts muted.'
    }
    return 'Audio-first entry. Camera can be added later without dropping voice.'
  }, [cameraEnabled, micEnabled])

  useEffect(() => {
    if (!videoRef.current) {
      return
    }

    videoRef.current.srcObject = previewStream
  }, [previewStream])

  useEffect(() => {
    let cancelled = false

    async function syncPreview() {
      setPreviewError(null)

      if (!open) {
        releasePreviewTracks(previewVideoTrackRef, previewAudioTrackRef, previewStreamRef)
        setPreviewStream(null)
        return
      }

      if (!micEnabled && !cameraEnabled) {
        releasePreviewTracks(previewVideoTrackRef, previewAudioTrackRef, previewStreamRef)
        setPreviewStream(null)
        setPreviewStatus('Microphone and camera are both off. You can still join muted and add them later.')
        return
      }

      if (!navigator.mediaDevices?.getUserMedia) {
        setPreviewStatus('Preview unavailable in this browser.')
        setPreviewError('Media devices API is unavailable in this browser.')
        return
      }

      if (!window.isSecureContext) {
        setPreviewStatus('Preview unavailable on this origin.')
        setPreviewError('Open this page on localhost or HTTPS to use microphone and camera.')
        return
      }

      setPreviewStatus('Requesting microphone and camera access…')

      try {
        if (cameraEnabled && !previewVideoTrackRef.current) {
          const videoStream = await navigator.mediaDevices.getUserMedia({
            audio: false,
            video: true
          })
          const [videoTrack] = videoStream.getVideoTracks()
          if (videoTrack) {
            previewVideoTrackRef.current = videoTrack
            logInfo('prejoin', 'camera preview track acquired', { trackId: videoTrack.id })
          }
        }

        if (!cameraEnabled && previewVideoTrackRef.current) {
          previewVideoTrackRef.current.stop()
          previewVideoTrackRef.current = null
          logInfo('prejoin', 'camera preview track released')
        }

        if (micEnabled && !previewAudioTrackRef.current) {
          const audioStream = await navigator.mediaDevices.getUserMedia({
            audio: true,
            video: false
          })
          const [audioTrack] = audioStream.getAudioTracks()
          if (audioTrack) {
            previewAudioTrackRef.current = audioTrack
            logInfo('prejoin', 'microphone preview track acquired', { trackId: audioTrack.id })
          }
        }

        if (!micEnabled && previewAudioTrackRef.current) {
          previewAudioTrackRef.current.stop()
          previewAudioTrackRef.current = null
          logInfo('prejoin', 'microphone preview track released')
        }

        if (cancelled) {
          return
        }

        const nextPreviewStream = buildPreviewStream(previewStreamRef.current, previewVideoTrackRef.current)
        previewStreamRef.current = nextPreviewStream
        setPreviewStream(nextPreviewStream)
        setPreviewStatus(
          describePreview(
            nextPreviewStream ?? new MediaStream(),
            micEnabled,
            cameraEnabled
          )
        )
      } catch (error) {
        if (cancelled) {
          return
        }

        setPreviewStatus('Preview unavailable.')
        setPreviewError(describeMediaError(error))
        logWarn('prejoin', 'preview sync failed', { error: describeMediaError(error) })
      }
    }

    void syncPreview()

    return () => {
      cancelled = true
    }
  }, [open, micEnabled, cameraEnabled])

  useEffect(() => {
    return () => {
      releasePreviewTracks(previewVideoTrackRef, previewAudioTrackRef, previewStreamRef)
    }
  }, [])

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
          <div className="overflow-hidden rounded-[18px] border border-white/10 bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.24),_transparent_42%),linear-gradient(180deg,_rgba(15,23,42,0.94),_rgba(2,6,23,0.98))]">
            {previewStream && cameraEnabled ? (
              <video ref={videoRef} autoPlay muted playsInline className="h-64 w-full object-cover" />
            ) : (
              <div className="flex h-64 items-center justify-center">
                <div className="text-center">
                  <Video className="mx-auto mb-3 h-10 w-10 text-emerald-300" />
                  <p className="max-w-xs text-sm text-slate-200">{previewLabel}</p>
                </div>
              </div>
            )}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Badge className={window.isSecureContext ? 'bg-emerald-500/20 text-emerald-100' : 'bg-red-500/20 text-red-100'}>
              {window.isSecureContext ? 'Secure context' : 'Open on localhost or HTTPS'}
            </Badge>
            <Badge className={micEnabled ? 'bg-emerald-500/20 text-emerald-100' : 'bg-slate-500/30 text-slate-200'}>
              {micEnabled ? 'Mic requested' : 'Mic off'}
            </Badge>
            <Badge className={cameraEnabled ? 'bg-emerald-500/20 text-emerald-100' : 'bg-slate-500/30 text-slate-200'}>
              {cameraEnabled ? 'Camera preview requested' : 'Camera off'}
            </Badge>
          </div>
          <p className="mt-3 text-sm text-slate-200">{previewStatus}</p>
          {previewError ? <p className="mt-2 text-sm text-rose-200">{previewError}</p> : null}
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

function describePreview(stream: MediaStream, micEnabled: boolean, cameraEnabled: boolean) {
  const hasVideo = stream.getVideoTracks().length > 0
  const hasAudio = stream.getAudioTracks().length > 0

  if (hasVideo && hasAudio && micEnabled && cameraEnabled) {
    return 'Camera preview is live and microphone access is ready.'
  }
  if (hasVideo && cameraEnabled) {
    return 'Camera preview is live. Microphone starts muted.'
  }
  if (hasAudio && micEnabled) {
    return 'Microphone access is ready. Camera starts off.'
  }

  return 'Preview is ready.'
}

function buildPreviewStream(current: MediaStream | null, videoTrack: MediaStreamTrack | null) {
  if (!videoTrack) {
    return null
  }

  const stream = current ?? createPreviewMediaStream()
  const existingTracks = stream.getVideoTracks()
  for (const track of existingTracks) {
    if (track !== videoTrack) {
      stream.removeTrack(track)
    }
  }
  if (!existingTracks.includes(videoTrack)) {
    stream.addTrack(videoTrack)
  }
  return stream
}

function createPreviewMediaStream() {
  if (typeof MediaStream !== 'undefined') {
    return new MediaStream()
  }

  const tracks: MediaStreamTrack[] = []
  return {
    addTrack(track: MediaStreamTrack) {
      if (!tracks.includes(track)) {
        tracks.push(track)
      }
    },
    removeTrack(track: MediaStreamTrack) {
      const index = tracks.indexOf(track)
      if (index >= 0) {
        tracks.splice(index, 1)
      }
    },
    getTracks() {
      return [...tracks]
    },
    getVideoTracks() {
      return tracks.filter((track) => track.kind === 'video')
    },
    getAudioTracks() {
      return tracks.filter((track) => track.kind === 'audio')
    }
  } as MediaStream
}

function releasePreviewTracks(
  videoTrackRef: React.MutableRefObject<MediaStreamTrack | null>,
  audioTrackRef: React.MutableRefObject<MediaStreamTrack | null>,
  streamRef: React.MutableRefObject<MediaStream | null>
) {
  videoTrackRef.current?.stop()
  audioTrackRef.current?.stop()
  videoTrackRef.current = null
  audioTrackRef.current = null
  streamRef.current = null
}

function describeMediaError(error: unknown) {
  if (!(error instanceof Error)) {
    return 'Unable to access selected media devices.'
  }

  if (error.name === 'NotAllowedError') {
    return 'Browser access to microphone or camera was denied.'
  }
  if (error.name === 'NotFoundError') {
    return 'No matching microphone or camera was found.'
  }
  if (error.name === 'NotReadableError') {
    return 'Microphone or camera is busy in another app.'
  }

  return error.message || 'Unable to access selected media devices.'
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
