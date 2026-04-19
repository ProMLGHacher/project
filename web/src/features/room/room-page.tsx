import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ConferenceClient, type ConferenceDiagnostics } from '@/lib/rtc/conference-client'
import { conferenceApi } from '@/lib/api'
import { clearClientLogs, exportClientLogsText, getClientLogs, logError, logInfo, subscribeClientLogs } from '@/lib/logger'
import type {
  JoinResponse,
  ParticipantState,
  RoomMetadata,
  RoomSnapshot,
  SlotUpdatedPayload
} from '@/features/protocol/types'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ParticipantGrid } from '@/features/room/participant-grid'
import { ControlBar } from '@/features/room/control-bar'
import { PrejoinModal } from '@/features/prejoin/prejoin-modal'

type ParticipantMap = Record<string, ParticipantState>

export function RoomPage() {
  const { roomId = '' } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const requestedRole = searchParams.get('role') === 'host' ? 'host' : 'participant'
  const clientRef = useRef<ConferenceClient | null>(null)
  const [room, setRoom] = useState<RoomMetadata | null>(null)
  const [roomLoading, setRoomLoading] = useState(true)
  const [prejoinLoading, setPrejoinLoading] = useState(false)
  const [activeSession, setActiveSession] = useState<JoinResponse | null>(null)
  const [participants, setParticipants] = useState<ParticipantMap>({})
  const [localStream, setLocalStream] = useState<MediaStream | null>(null)
  const [remoteStreams, setRemoteStreams] = useState<Record<string, MediaStream>>({})
  const [connectionState, setConnectionState] = useState('idle')
  const [diagnostics, setDiagnostics] = useState<ConferenceDiagnostics | null>(null)
  const [roomError, setRoomError] = useState<string | null>(null)
  const [actionStatus, setActionStatus] = useState('Check your setup before joining.')
  const [micEnabled, setMicEnabled] = useState(true)
  const [cameraEnabled, setCameraEnabled] = useState(false)
  const [screenEnabled, setScreenEnabled] = useState(false)
  const [logCount, setLogCount] = useState(() => getClientLogs().length)

  useEffect(() => {
    let cancelled = false

    setRoomLoading(true)
    setRoomError(null)
    setActiveSession(null)
    setParticipants({})
    setLocalStream(null)
    setRemoteStreams({})
    setConnectionState('idle')
    setDiagnostics(null)
    setActionStatus('Check your setup before joining.')
    setMicEnabled(true)
    setCameraEnabled(false)
    setScreenEnabled(false)
    logInfo('room', 'loading room route', { roomId, requestedRole })

    async function loadRoom() {
      try {
        const metadata = await conferenceApi.getRoom(roomId)
        if (!cancelled) {
          setRoom(metadata)
          logInfo('room', 'room metadata loaded', metadata)
        }
      } catch (error) {
        if (!cancelled) {
          setRoom(null)
          setRoomError(readableError(error))
          setActionStatus('Room is unavailable.')
          logError('room', 'room metadata load failed', { roomId, error: readableError(error) })
        }
      } finally {
        if (!cancelled) {
          setRoomLoading(false)
        }
      }
    }

    void loadRoom()

    return () => {
      cancelled = true
    }
  }, [roomId])

  useEffect(() => {
    return subscribeClientLogs((nextEntries) => {
      setLogCount(nextEntries.length)
    })
  }, [])

  useEffect(() => {
    if (!activeSession) {
      return
    }

    setParticipants(indexParticipants(activeSession.snapshot))
    setLocalStream(null)
    setRemoteStreams({})
    setDiagnostics(null)
    setConnectionState('connecting')

    const localParticipant = activeSession.snapshot.participants.find(
      (participant) => participant.id === activeSession.participantId
    )

    setMicEnabled(localParticipant?.slots.find((slot) => slot.kind === 'audio')?.enabled ?? true)
    setCameraEnabled(localParticipant?.slots.find((slot) => slot.kind === 'camera')?.enabled ?? false)
    setScreenEnabled(localParticipant?.slots.find((slot) => slot.kind === 'screen')?.enabled ?? false)
  }, [activeSession])

  useEffect(() => {
    if (!activeSession) {
      return
    }

    const localParticipant = activeSession.snapshot.participants.find(
      (participant) => participant.id === activeSession.participantId
    )
    const sessionMicEnabled = localParticipant?.slots.find((slot) => slot.kind === 'audio')?.enabled ?? true
    const sessionCameraEnabled = localParticipant?.slots.find((slot) => slot.kind === 'camera')?.enabled ?? false

    const client = new ConferenceClient({
      onSnapshot: (snapshot) => {
        setParticipants(indexParticipants(snapshot))
        setRemoteStreams((current) => {
          const activeParticipantIds = new Set(snapshot.participants.map((participant) => participant.id))
          return Object.fromEntries(
            Object.entries(current).filter(([participantId]) => activeParticipantIds.has(participantId))
          )
        })
      },
      onSlotUpdated: (payload) => setParticipants((current) => patchParticipantSlot(current, payload)),
      onRemoteTrack: (participantId, _kind, stream) => {
        setRemoteStreams((current) => ({ ...current, [participantId]: stream }))
      },
      onLocalStream: (stream) => {
        setLocalStream(stream)
      },
      onStateChange: setConnectionState,
      onDiagnostics: setDiagnostics,
      onError: (message) => setRoomError(message)
    })

    clientRef.current = client
    setActionStatus('Connecting signaling and media…')

    void client
      .start({
        wsUrl: activeSession.wsUrl,
        iceServers: activeSession.iceServers,
        micEnabled: sessionMicEnabled,
        cameraEnabled: sessionCameraEnabled
      })
      .then(() => {
        setActionStatus('Room session is live.')
      })
      .catch((error) => {
        setConnectionState('error')
        setRoomError(readableError(error))
        setActionStatus('Room session failed to start.')
      })

    return () => {
      client.close()
      if (clientRef.current === client) {
        clientRef.current = null
      }
    }
  }, [activeSession])

  const secureContext = window.isSecureContext
  const participantList = Object.values(participants)
  const otherParticipants = activeSession
    ? participantList.filter((participant) => participant.id !== activeSession.participantId)
    : []
  const participantNames = participantList.map((participant) => participant.displayName).join(', ')
  const visibleRemoteStreams = otherParticipants.filter((participant) => Boolean(remoteStreams[participant.id])).length

  async function handleJoin(payload: { displayName: string; micEnabled: boolean; cameraEnabled: boolean }) {
    setPrejoinLoading(true)
    setRoomError(null)
    setActionStatus('Starting room session…')

    try {
      const result = await conferenceApi.joinRoom(roomId, {
        ...payload,
        role: requestedRole
      })

      setActiveSession(result)
      setActionStatus('Joining room…')
      logInfo('room', 'room join succeeded', {
        roomId: result.roomId,
        participantId: result.participantId,
        role: result.role,
        wsUrl: result.wsUrl
      })
    } catch (error) {
      setRoomError(readableError(error))
      setActionStatus('Join failed.')
      logError('room', 'room join failed', { roomId, requestedRole, error: readableError(error) })
    } finally {
      setPrejoinLoading(false)
    }
  }

  async function handleMicToggle() {
    if (!activeSession) {
      return
    }

    const next = !micEnabled
    setRoomError(null)
    setActionStatus(next ? 'Turning microphone on…' : 'Muting microphone…')
    try {
      await clientRef.current?.setMicEnabled(next)
      setMicEnabled(next)
      setParticipants((current) =>
        patchParticipantSlot(current, {
          participantId: activeSession.participantId,
          kind: 'audio',
          enabled: next,
          publishing: next,
          trackBound: true
        })
      )
      setActionStatus(next ? 'Microphone is live.' : 'Microphone muted.')
    } catch (error) {
      setRoomError(readableError(error))
      setActionStatus('Microphone toggle failed.')
    }
  }

  async function handleCameraToggle() {
    if (!activeSession) {
      return
    }

    const next = !cameraEnabled
    setRoomError(null)
    setActionStatus(next ? 'Turning camera on…' : 'Turning camera off…')
    try {
      await clientRef.current?.setCameraEnabled(next)
      setCameraEnabled(next)
      setParticipants((current) =>
        patchParticipantSlot(current, {
          participantId: activeSession.participantId,
          kind: 'camera',
          enabled: next,
          publishing: next,
          trackBound: next
        })
      )
      setActionStatus(next ? 'Camera is live.' : 'Camera is off.')
    } catch (error) {
      setRoomError(readableError(error))
      setActionStatus('Camera toggle failed.')
    }
  }

  async function handleScreenToggle() {
    if (!activeSession) {
      return
    }

    const next = !screenEnabled
    setRoomError(null)
    setActionStatus(next ? 'Starting screen share…' : 'Stopping screen share…')
    try {
      await clientRef.current?.setScreenEnabled(next)
      setScreenEnabled(next)
      setParticipants((current) =>
        patchParticipantSlot(current, {
          participantId: activeSession.participantId,
          kind: 'screen',
          enabled: next,
          publishing: next,
          trackBound: next
        })
      )
      setActionStatus(next ? 'Screen share is live.' : 'Screen share stopped.')
    } catch (error) {
      setRoomError(readableError(error))
      setActionStatus('Screen share toggle failed.')
    }
  }

  async function handleCopyLink() {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/rooms/${roomId}`)
      setActionStatus('Room link copied.')
      logInfo('room', 'room link copied', { roomId })
    } catch (error) {
      setRoomError(readableError(error))
      setActionStatus('Copy link failed.')
      logError('room', 'room link copy failed', { roomId, error: readableError(error) })
    }
  }

  async function handleExportLogs() {
    try {
      const blob = new Blob([exportClientLogsText()], { type: 'text/plain;charset=utf-8' })
      const url = window.URL.createObjectURL(blob)
      const link = window.document.createElement('a')
      link.href = url
      link.download = `voice-first-logs-${roomId || 'room'}.txt`
      window.document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
      setActionStatus('Client logs exported.')
      logInfo('room', 'client logs exported', { roomId, logCount: getClientLogs().length })
    } catch (error) {
      setRoomError(readableError(error))
      setActionStatus('Client log export failed.')
      logError('room', 'client log export failed', { roomId, error: readableError(error) })
    }
  }

  function handleClearLogs() {
    clearClientLogs()
    setActionStatus('Client logs cleared.')
    logInfo('room', 'client logs cleared', { roomId })
  }

  function handleLeave() {
    setActionStatus('Leaving room…')
    clientRef.current?.close()
    clientRef.current = null
    setActiveSession(null)
    setParticipants({})
    setLocalStream(null)
    setRemoteStreams({})
    navigate('/')
  }

  if (!activeSession) {
    return (
      <main className="flex min-h-screen items-center justify-center px-6 py-16">
        <Card className="w-full max-w-3xl">
          <CardHeader>
            <Badge className="w-fit">Room setup</Badge>
            <CardTitle>Join room {roomId}</CardTitle>
            <CardDescription>
              Open the room directly, choose your microphone and camera preferences, then enter from here.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            {roomLoading ? <p>Loading room details…</p> : null}
            {!roomLoading && room ? <p>Participants currently inside: {room.participantCount}</p> : null}
            {!roomLoading && room ? <p>Joining as: {requestedRole === 'host' ? 'Host' : 'Participant'}</p> : null}
            {roomError ? <p className="text-red-600">{roomError}</p> : null}
          </CardContent>
        </Card>

        <PrejoinModal open={!roomLoading && Boolean(room)} loading={prejoinLoading} onJoin={handleJoin} />
      </main>
    )
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-7xl flex-col gap-6 px-6 py-8">
      <header className="grid gap-4 rounded-[32px] border border-border/60 bg-white/70 p-6 shadow-sm backdrop-blur lg:grid-cols-[1fr,auto] lg:items-center">
        <div>
          <Badge className="bg-accent text-accent-foreground">Room live</Badge>
          <h1 className="mt-4 font-display text-3xl font-semibold">Voice-first room {roomId}</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Join happens on the room URL itself, audio stays first, and camera or screen share can be added without
            replacing the live call.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge>{participantList.length} participants</Badge>
          <Badge>{connectionState}</Badge>
          <Badge>{visibleRemoteStreams} remote streams</Badge>
          <Badge>{logCount} client logs</Badge>
        </div>
      </header>

      {!secureContext ? (
        <Card className="border-red-200 bg-red-50">
          <CardHeader>
            <CardTitle className="text-red-700">Media Capture Is Blocked On This Origin</CardTitle>
            <CardDescription className="text-red-700/80">
              Open the app on `http://localhost:8023` or over HTTPS if you want microphone, camera, and screen sharing
              to work in the browser.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>What To Report</CardTitle>
          <CardDescription>
            These values are meant for debugging in plain language: tell me what badges you see here if something looks
            wrong.
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

      <Card>
        <CardHeader>
          <CardTitle>Logs</CardTitle>
          <CardDescription>
            Export the saved client logs from this device and send me the file. This is especially useful on phones
            where the browser console is hard to access.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <button className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground" onClick={handleExportLogs} type="button">
            Export client logs
          </button>
          <button className="inline-flex h-10 items-center justify-center rounded-md border border-border bg-background px-4 text-sm font-medium" onClick={handleClearLogs} type="button">
            Clear client logs
          </button>
        </CardContent>
      </Card>

      <ParticipantGrid
        participants={participantList}
        localParticipantId={activeSession.participantId}
        localStream={localStream}
        remoteStreams={remoteStreams}
      />

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
