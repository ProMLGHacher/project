import { useEffect, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { conferenceApi } from '@/lib/api'
import { PrejoinModal } from '@/features/prejoin/prejoin-modal'
import { storeJoinSession } from '@/features/session/session-storage'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { ParticipantRole, RoomMetadata } from '@/features/protocol/types'

export function RoomJoinPage() {
  const { roomId = '' } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const requestedRole = searchParams.get('role') === 'host' ? 'host' : 'participant'
  const [room, setRoom] = useState<RoomMetadata | null>(null)
  const [loading, setLoading] = useState(true)
  const [joining, setJoining] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function loadRoom() {
      try {
        const metadata = await conferenceApi.getRoom(roomId)
        if (!cancelled) {
          setRoom(metadata)
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void loadRoom()

    return () => {
      cancelled = true
    }
  }, [roomId])

  async function handleJoin(payload: { displayName: string; micEnabled: boolean; cameraEnabled: boolean }) {
    setJoining(true)
    try {
      const result = await conferenceApi.joinRoom(roomId, {
        ...payload,
        role: requestedRole
      })
      storeJoinSession(result)
      navigate(`/rooms/${result.roomId}`)
    } finally {
      setJoining(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-16">
      <Card className="w-full max-w-3xl">
        <CardHeader>
          <Badge className="w-fit">Room preflight</Badge>
          <CardTitle>Preparing your room session</CardTitle>
          <CardDescription>
            Enter with a room id. The creator can join as host, everyone else joins as participant.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading room metadata…</p>
          ) : (
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>Room: {room?.roomId}</p>
              <p>Joining as: {labelForRole(requestedRole)}</p>
              <p>Participants currently inside: {room?.participantCount ?? 0}</p>
            </div>
          )}
        </CardContent>
      </Card>

      <PrejoinModal open={!loading && Boolean(room)} loading={joining} onJoin={handleJoin} />
    </main>
  )
}

function labelForRole(role: ParticipantRole) {
  return role === 'host' ? 'Host' : 'Participant'
}
