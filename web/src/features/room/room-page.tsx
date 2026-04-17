import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { ConferenceClient } from '@/lib/rtc/conference-client'
import { loadJoinSession } from '@/features/session/session-storage'
import type { ParticipantState, RoomSnapshot, SlotKind, SlotUpdatedPayload } from '@/features/protocol/types'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ParticipantGrid } from '@/features/room/participant-grid'
import { ControlBar } from '@/features/room/control-bar'

type ParticipantMap = Record<string, ParticipantState>

export function RoomPage() {
  const { roomId = '' } = useParams()
  const joinSession = useMemo(() => loadJoinSession(roomId), [roomId])
  const clientRef = useRef<ConferenceClient | null>(null)
  const [participants, setParticipants] = useState<ParticipantMap>(() => indexParticipants(joinSession?.snapshot))
  const [streams, setStreams] = useState<Record<string, MediaStream>>({})
  const [connectionState, setConnectionState] = useState('idle')
  const [micEnabled, setMicEnabled] = useState(joinSession?.snapshot.participants.find((participant) => participant.id === joinSession.participantId)?.slots.find((slot) => slot.kind === 'audio')?.enabled ?? true)
  const [cameraEnabled, setCameraEnabled] = useState(joinSession?.snapshot.participants.find((participant) => participant.id === joinSession.participantId)?.slots.find((slot) => slot.kind === 'camera')?.enabled ?? false)
  const [screenEnabled, setScreenEnabled] = useState(false)

  useEffect(() => {
    if (!joinSession) {
      return
    }

    const client = new ConferenceClient({
      onSnapshot: (snapshot) => setParticipants(indexParticipants(snapshot)),
      onSlotUpdated: (payload) => setParticipants((current) => patchParticipantSlot(current, payload)),
      onRemoteTrack: (participantId, _kind, stream) => {
        setStreams((current) => ({ ...current, [participantId]: stream }))
      },
      onStateChange: setConnectionState
    })

    clientRef.current = client
    void client.start({
      wsUrl: joinSession.wsUrl,
      iceServers: joinSession.iceServers,
      micEnabled,
      cameraEnabled
    })

    return () => {
      client.close()
    }
  }, [joinSession])

  const participantList = useMemo(() => Object.values(participants), [participants])

  if (!joinSession) {
    return (
      <main className="flex min-h-screen items-center justify-center px-6">
        <Card className="max-w-lg">
          <CardHeader>
            <CardTitle>Session not found</CardTitle>
            <CardDescription>Open the invite link again so the prejoin flow can issue a fresh room session.</CardDescription>
          </CardHeader>
        </Card>
      </main>
    )
  }

  const activeSession = joinSession
  const localParticipant = participants[activeSession.participantId]

  async function handleMicToggle() {
    const next = !micEnabled
    setMicEnabled(next)
    await clientRef.current?.setMicEnabled(next)
    if (localParticipant) {
      setParticipants((current) => patchParticipantSlot(current, {
        participantId: activeSession.participantId,
        kind: 'audio',
        enabled: next,
        publishing: next,
        trackBound: true
      }))
    }
  }

  async function handleCameraToggle() {
    const next = !cameraEnabled
    setCameraEnabled(next)
    await clientRef.current?.setCameraEnabled(next)
    setParticipants((current) => patchParticipantSlot(current, {
      participantId: activeSession.participantId,
      kind: 'camera',
      enabled: next,
      publishing: next,
      trackBound: next
    }))
  }

  async function handleScreenToggle() {
    const next = !screenEnabled
    setScreenEnabled(next)
    await clientRef.current?.setScreenEnabled(next)
    setParticipants((current) => patchParticipantSlot(current, {
      participantId: activeSession.participantId,
      kind: 'screen',
      enabled: next,
      publishing: next,
      trackBound: next
    }))
  }

  async function handleCopyLink() {
    const inviteToken = joinSession?.inviteToken
    const inviteURL = inviteToken ? `${window.location.origin}/invite/${inviteToken}` : window.location.href
    await navigator.clipboard.writeText(inviteURL)
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-7xl flex-col gap-6 px-6 py-8">
      <header className="grid gap-4 rounded-[32px] border border-border/60 bg-white/70 p-6 shadow-sm backdrop-blur lg:grid-cols-[1fr,auto] lg:items-center">
        <div>
          <Badge className="bg-accent text-accent-foreground">Room live</Badge>
          <h1 className="mt-4 font-display text-3xl font-semibold">Voice-first room {roomId}</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Publisher and subscriber stay separate, audio keeps priority, and camera or screen slots can be negotiated in without replacing the live call.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge>{participantList.length} participants</Badge>
          <Badge>{connectionState}</Badge>
        </div>
      </header>

          <ParticipantGrid participants={participantList} localParticipantId={activeSession.participantId} streams={streams} />

      <div className="sticky bottom-4 flex justify-center">
        <ControlBar
          micEnabled={micEnabled}
          cameraEnabled={cameraEnabled}
          screenEnabled={screenEnabled}
          onMicToggle={handleMicToggle}
          onCameraToggle={handleCameraToggle}
          onScreenToggle={handleScreenToggle}
          onCopyLink={handleCopyLink}
        />
      </div>
    </main>
  )
}

function indexParticipants(snapshot?: RoomSnapshot): ParticipantMap {
  return Object.fromEntries((snapshot?.participants ?? []).map((participant) => [participant.id, participant]))
}

function patchParticipantSlot(current: ParticipantMap, payload: SlotUpdatedPayload): ParticipantMap {
  const participant = current[payload.participantId]
  if (!participant) {
    return current
  }

  return {
    ...current,
    [payload.participantId]: {
      ...participant,
      slots: participant.slots.map((slot) =>
        slot.kind === payload.kind
          ? {
              ...slot,
              enabled: payload.enabled,
              publishing: payload.publishing,
              trackBound: payload.trackBound,
              revision: slot.revision + 1
            }
          : slot
      )
    }
  }
}

export function applySlotPatch(current: ParticipantMap, payload: SlotUpdatedPayload) {
  return patchParticipantSlot(current, payload)
}

export type { ParticipantMap }
