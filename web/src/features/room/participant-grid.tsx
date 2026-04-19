import { memo, useEffect, useRef } from 'react'
import type { ParticipantState } from '@/features/protocol/types'
import { Badge } from '@/components/ui/badge'
import { logInfo } from '@/lib/logger'

interface ParticipantGridProps {
  participants: ParticipantState[]
  localParticipantId: string
  localStream: MediaStream | null
  remoteStreams: Record<string, MediaStream>
}

export function ParticipantGrid({ participants, localParticipantId, localStream, remoteStreams }: ParticipantGridProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {participants.map((participant) => {
        const stream = participant.id === localParticipantId ? localStream : remoteStreams[participant.id]
        const cameraSlot = participant.slots.find((slot) => slot.kind === 'camera')
        const audioSlot = participant.slots.find((slot) => slot.kind === 'audio')
        const screenSlot = participant.slots.find((slot) => slot.kind === 'screen')
        const showVideo = Boolean(stream) && (cameraSlot?.enabled || screenSlot?.enabled)
        const awaitingMedia = !stream && (audioSlot?.enabled || cameraSlot?.enabled || screenSlot?.enabled)

        return (
          <article key={participant.id} className="overflow-hidden rounded-[28px] border border-border/60 bg-card/90 shadow-sm">
            <div className="flex h-52 items-center justify-center bg-slate-950 text-slate-100">
              {showVideo && stream ? (
                <ParticipantVideo
                  participantId={participant.id}
                  stream={stream}
                  muted={participant.id === localParticipantId}
                  isLocal={participant.id === localParticipantId}
                />
              ) : (
                <div className="text-center text-sm text-slate-300">
                  <p className="font-medium">{participant.displayName}</p>
                  <p>{screenSlot?.enabled ? 'Screen share ready' : cameraSlot?.enabled ? 'Camera signal is on, waiting for media…' : 'Camera is off'}</p>
                  {awaitingMedia ? <p className="mt-2 text-xs text-slate-400">Participant is present, but remote media has not attached yet.</p> : null}
                </div>
              )}
              {audioSlot?.enabled && stream && participant.id !== localParticipantId ? (
                <ParticipantAudio participantId={participant.id} stream={stream} />
              ) : null}
            </div>
            <div className="flex items-center justify-between gap-3 p-4">
              <div>
                <h3 className="font-medium">{participant.displayName}</h3>
                <p className="text-sm text-muted-foreground">{participant.role === 'host' ? 'Host' : 'Participant'}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge>{audioSlot?.enabled ? 'Mic live' : 'Muted'}</Badge>
                <Badge>{cameraSlot?.enabled ? 'Camera on' : 'Camera off'}</Badge>
                {screenSlot?.enabled ? <Badge className="bg-accent text-accent-foreground">Screen</Badge> : null}
                {awaitingMedia ? <Badge className="bg-amber-100 text-amber-900">Waiting for media</Badge> : null}
              </div>
            </div>
          </article>
        )
      })}
    </div>
  )
}

const ParticipantVideo = memo(function ParticipantVideo({
  participantId,
  stream,
  muted,
  isLocal
}: {
  participantId: string
  stream: MediaStream
  muted: boolean
  isLocal: boolean
}) {
  const ref = useRef<HTMLVideoElement | null>(null)

  useEffect(() => {
    const node = ref.current
    if (!node) {
      return
    }

    if (node.srcObject !== stream) {
      node.srcObject = stream
      logInfo('room-media', 'video stream attached', {
        participantId,
        isLocal,
        trackIds: describeTracks(stream)
      })
    }

    const handlePlaying = () => {
      logInfo('room-media', 'video playing', { participantId, isLocal, readyState: node.readyState })
    }
    const handleWaiting = () => {
      logInfo('room-media', 'video waiting', { participantId, isLocal, readyState: node.readyState })
    }
    const handleStalled = () => {
      logInfo('room-media', 'video stalled', { participantId, isLocal, readyState: node.readyState })
    }

    node.addEventListener('playing', handlePlaying)
    node.addEventListener('waiting', handleWaiting)
    node.addEventListener('stalled', handleStalled)

    return () => {
      node.removeEventListener('playing', handlePlaying)
      node.removeEventListener('waiting', handleWaiting)
      node.removeEventListener('stalled', handleStalled)
    }
  }, [participantId, stream, isLocal])

  return <video autoPlay muted={muted} playsInline ref={ref} className="h-full w-full object-cover" />
})

const ParticipantAudio = memo(function ParticipantAudio({
  participantId,
  stream
}: {
  participantId: string
  stream: MediaStream
}) {
  const ref = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    const node = ref.current
    if (!node) {
      return
    }

    if (node.srcObject !== stream) {
      node.srcObject = stream
      logInfo('room-media', 'audio stream attached', {
        participantId,
        trackIds: describeTracks(stream)
      })
    }
  }, [participantId, stream])

  return <audio autoPlay ref={ref} />
})

function describeTracks(stream: MediaStream) {
  if (typeof stream.getTracks !== 'function') {
    return []
  }

  return stream.getTracks().map((track) => track.id)
}
