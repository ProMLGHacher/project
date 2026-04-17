import type { ParticipantState } from '@/features/protocol/types'
import { Badge } from '@/components/ui/badge'

interface ParticipantGridProps {
  participants: ParticipantState[]
  localParticipantId: string
  streams: Record<string, MediaStream>
}

export function ParticipantGrid({ participants, localParticipantId, streams }: ParticipantGridProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {participants.map((participant) => {
        const stream = streams[participant.id]
        const cameraSlot = participant.slots.find((slot) => slot.kind === 'camera')
        const audioSlot = participant.slots.find((slot) => slot.kind === 'audio')
        const screenSlot = participant.slots.find((slot) => slot.kind === 'screen')
        const showVideo = Boolean(stream) && (cameraSlot?.enabled || screenSlot?.enabled)

        return (
          <article key={participant.id} className="overflow-hidden rounded-[28px] border border-border/60 bg-card/90 shadow-sm">
            <div className="flex h-52 items-center justify-center bg-slate-950 text-slate-100">
              {showVideo ? (
                <video
                  autoPlay
                  muted={participant.id === localParticipantId}
                  playsInline
                  ref={(node) => {
                    if (node && stream) {
                      node.srcObject = stream
                    }
                  }}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="text-center text-sm text-slate-300">
                  <p className="font-medium">{participant.displayName}</p>
                  <p>{screenSlot?.enabled ? 'Screen share ready' : 'Camera is off'}</p>
                </div>
              )}
              {audioSlot?.enabled && stream ? (
                <audio
                  autoPlay
                  ref={(node) => {
                    if (node) {
                      node.srcObject = stream
                    }
                  }}
                />
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
              </div>
            </div>
          </article>
        )
      })}
    </div>
  )
}
