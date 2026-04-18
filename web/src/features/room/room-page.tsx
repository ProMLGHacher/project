import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ConferenceClient, type ConferenceDiagnostics } from '@/lib/rtc/conference-client'
import { clearJoinSession, loadJoinSession } from '@/features/session/session-storage'
import type { ParticipantState, RoomSnapshot, SlotKind, SlotUpdatedPayload } from '@/features/protocol/types'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ParticipantGrid } from '@/features/room/participant-grid'
import { ControlBar } from '@/features/room/control-bar'

type ParticipantMap = Record<string, ParticipantState>

export function RoomPage() {
  const { roomId = '' } = useParams()
  const navigate = useNavigate()
  const joinSession = useMemo(() => loadJoinSession(roomId), [roomId])
  const clientRef = useRef<ConferenceClient | null>(null)
  const [participants, setParticipants] = useState<ParticipantMap>(() => indexParticipants(joinSession?.snapshot))
  const [streams, setStreams] = useState<Record<string, MediaStream>>({})
  const [connectionState, setConnectionState] = useState('idle')
  const [diagnostics, setDiagnostics] = useState<ConferenceDiagnostics | null>(null)
  const [roomError, setRoomError] = useState<string | null>(null)
  const [actionStatus, setActionStatus] = useState('Waiting for room session to start.')
  const [micEnabled, setMicEnabled] = useState(joinSession?.snapshot.participants.find((participant) => participant.id === joinSession.participantId)?.slots.find((slot) => slot.kind === 'audio')?.enabled ?? true)
  const [cameraEnabled, setCameraEnabled] = useState(joinSession?.snapshot.participants.find((participant) => participant.id === joinSession.participantId)?.slots.find((slot) => slot.kind === 'camera')?.enabled ?? false)
  const [screenEnabled, setScreenEnabled] = useState(false)

  useEffect(() => {
    if (!joinSession) {
      return
    }

    const client = new ConferenceClient({
      onSnapshot: (snapshot) => {
        setParticipants(indexParticipants(snapshot))
        setStreams((current) => {
          const activeParticipantIds = new Set(snapshot.participants.map((participant) => participant.id))
          return Object.fromEntries(Object.entries(current).filter(([participantId]) => activeParticipantIds.has(participantId)))
        })
      },
      onSlotUpdated: (payload) => setParticipants((current) => patchParticipantSlot(current, payload)),
      onRemoteTrack: (participantId, _kind, stream) => {
        setStreams((current) => ({ ...current, [participantId]: stream }))
      },
      onLocalStream: (stream) => {
        setStreams((current) => {
          if (!stream) {
            const { [joinSession.participantId]: _removed, ...rest } = current
            return rest
          }

          return {
            ...current,
            [joinSession.participantId]: stream
          }
        })
      },
      onStateChange: setConnectionState,
      onDiagnostics: setDiagnostics,
      onError: (message) => setRoomError(message)
    })

    clientRef.current = client
    setActionStatus('Connecting signaling and media…')
    void client.start({
      wsUrl: joinSession.wsUrl,
      iceServers: joinSession.iceServers,
      micEnabled,
      cameraEnabled
    }).then(() => {
      setActionStatus('Room session is live.')
    }).catch((error) => {
      setConnectionState('error')
      setRoomError(readableError(error))
      setActionStatus('Room session failed to start.')
    })

    return () => {
      client.close()
    }
  }, [joinSession])

  if (!joinSession) {
    return (
      <main className="flex min-h-screen items-center justify-center px-6">
        <Card className="max-w-lg">
          <CardHeader>
            <CardTitle>Session not found</CardTitle>
            <CardDescription>Open the room join page again so the prejoin flow can issue a fresh room session.</CardDescription>
          </CardHeader>
        </Card>
      </main>
    )
  }

  const activeSession = joinSession
  const localParticipant = participants[activeSession.participantId]
  const secureContext = window.isSecureContext
  const participantList = useMemo(() => Object.values(participants), [participants])
  const otherParticipants = participantList.filter((participant) => participant.id !== activeSession.participantId)
  const participantNames = participantList.map((participant) => participant.displayName).join(', ')
  const visibleRemoteStreams = otherParticipants.filter((participant) => Boolean(streams[participant.id])).length

  async function handleMicToggle() {
    const next = !micEnabled
    setRoomError(null)
    setActionStatus(next ? 'Turning microphone on…' : 'Muting microphone…')
    try {
      await clientRef.current?.setMicEnabled(next)
      setMicEnabled(next)
      if (localParticipant) {
        setParticipants((current) => patchParticipantSlot(current, {
          participantId: activeSession.participantId,
          kind: 'audio',
          enabled: next,
          publishing: next,
          trackBound: true
        }))
      }
      setActionStatus(next ? 'Microphone is live.' : 'Microphone muted.')
    } catch (error) {
      setRoomError(readableError(error))
      setActionStatus('Microphone toggle failed.')
    }
  }

  async function handleCameraToggle() {
    const next = !cameraEnabled
    setRoomError(null)
    setActionStatus(next ? 'Turning camera on…' : 'Turning camera off…')
    try {
      await clientRef.current?.setCameraEnabled(next)
      setCameraEnabled(next)
      setParticipants((current) => patchParticipantSlot(current, {
        participantId: activeSession.participantId,
        kind: 'camera',
        enabled: next,
        publishing: next,
        trackBound: next
      }))
      setActionStatus(next ? 'Camera is live.' : 'Camera is off.')
    } catch (error) {
      setRoomError(readableError(error))
      setActionStatus('Camera toggle failed.')
    }
  }

  async function handleScreenToggle() {
    const next = !screenEnabled
    setRoomError(null)
    setActionStatus(next ? 'Starting screen share…' : 'Stopping screen share…')
    try {
      await clientRef.current?.setScreenEnabled(next)
      setScreenEnabled(next)
      setParticipants((current) => patchParticipantSlot(current, {
        participantId: activeSession.participantId,
        kind: 'screen',
        enabled: next,
        publishing: next,
        trackBound: next
      }))
      setActionStatus(next ? 'Screen share is live.' : 'Screen share stopped.')
    } catch (error) {
      setRoomError(readableError(error))
      setActionStatus('Screen share toggle failed.')
    }
  }

  async function handleCopyLink() {
    try {
      const roomJoinURL = joinSession?.roomJoinUrl ?? `${window.location.origin}/rooms/${activeSession.roomId}/join`
      await navigator.clipboard.writeText(roomJoinURL)
      setActionStatus('Room join link copied.')
    } catch (error) {
      setRoomError(readableError(error))
      setActionStatus('Copy link failed.')
    }
  }

  function handleLeave() {
    setActionStatus('Leaving room…')
    clientRef.current?.close()
    clearJoinSession(activeSession.roomId)
    navigate('/')
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
          <Badge>{visibleRemoteStreams} remote streams</Badge>
        </div>
      </header>

      {!secureContext ? (
        <Card className="border-red-200 bg-red-50">
          <CardHeader>
            <CardTitle className="text-red-700">Media Capture Is Blocked On This Origin</CardTitle>
            <CardDescription className="text-red-700/80">
              Open the app on `http://localhost:8023` or over HTTPS if you want microphone, camera, and screen sharing to work in the browser.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>What To Report</CardTitle>
          <CardDescription>
            These values are meant for debugging in plain language: tell me what badges you see here if something looks wrong.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
          <StatusBlock
            title="Room"
            lines={[
              `Origin: ${window.location.origin}`,
              `Secure context: ${secureContext ? 'yes' : 'no'}`,
              `Participants in snapshot: ${participantList.length}`,
              `Other participants: ${otherParticipants.length}`,
              `Participants list: ${participantNames || 'none'}`,
              `Action status: ${actionStatus}`
            ]}
          />
          <StatusBlock
            title="Publisher"
            lines={[
              `Signaling: ${diagnostics?.publisher.signalingState ?? 'unknown'}`,
              `Connection: ${diagnostics?.publisher.connectionState ?? 'unknown'}`,
              `ICE: ${diagnostics?.publisher.iceConnectionState ?? 'unknown'}`,
              `Mic track: ${diagnostics?.local.micTrack ? 'ready' : 'missing'}`,
              `Camera track: ${diagnostics?.local.cameraTrack ? 'ready' : 'missing'}`,
              `Screen track: ${diagnostics?.local.screenTrack ? 'ready' : 'missing'}`
            ]}
          />
          <StatusBlock
            title="Subscriber"
            lines={[
              `Socket: ${diagnostics?.signalingState ?? 'unknown'}`,
              `Signaling: ${diagnostics?.subscriber.signalingState ?? 'unknown'}`,
              `Connection: ${diagnostics?.subscriber.connectionState ?? 'unknown'}`,
              `ICE: ${diagnostics?.subscriber.iceConnectionState ?? 'unknown'}`,
              `Remote streams: ${visibleRemoteStreams}`
            ]}
          />
          <StatusBlock
            title="Signals"
            lines={[
              `Sent: ${joinSignals(diagnostics?.recentSignalsSent)}`,
              `Received: ${joinSignals(diagnostics?.recentSignalsReceived)}`,
              `Last error: ${roomError ?? diagnostics?.lastError ?? 'none'}`
            ]}
          />
        </CardContent>
      </Card>

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
          onLeave={handleLeave}
        />
      </div>
    </main>
  )
}

function joinSignals(items?: string[]) {
  if (!items || items.length === 0) {
    return 'none'
  }

  return items.join(', ')
}

function readableError(error: unknown) {
  if (error instanceof Error) {
    return error.message
  }
  return String(error)
}

function StatusBlock({ title, lines }: { title: string; lines: string[] }) {
  return (
    <section className="rounded-2xl border border-border/60 bg-muted/30 p-4">
      <h3 className="font-medium">{title}</h3>
      <div className="mt-3 space-y-2 text-sm text-muted-foreground">
        {lines.map((line) => (
          <p key={line}>{line}</p>
        ))}
      </div>
    </section>
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
