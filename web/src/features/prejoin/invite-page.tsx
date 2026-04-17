import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { conferenceApi } from '@/lib/api'
import { PrejoinModal } from '@/features/prejoin/prejoin-modal'
import { storeJoinSession } from '@/features/session/session-storage'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { InviteMetadata } from '@/features/protocol/types'

export function InvitePage() {
  const { token = '' } = useParams()
  const navigate = useNavigate()
  const [invite, setInvite] = useState<InviteMetadata | null>(null)
  const [loading, setLoading] = useState(true)
  const [joining, setJoining] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function loadInvite() {
      try {
        const metadata = await conferenceApi.getInvite(token)
        if (!cancelled) {
          setInvite(metadata)
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void loadInvite()

    return () => {
      cancelled = true
    }
  }, [token])

  async function handleJoin(payload: { displayName: string; micEnabled: boolean; cameraEnabled: boolean }) {
    setJoining(true)
    try {
      const result = await conferenceApi.joinInvite(token, payload)
      storeJoinSession(result, token)
      navigate(`/rooms/${result.roomId}`)
    } finally {
      setJoining(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-16">
      <Card className="w-full max-w-3xl">
        <CardHeader>
          <Badge className="w-fit">Invite preflight</Badge>
          <CardTitle>Preparing your room session</CardTitle>
          <CardDescription>
            We fetch invite metadata, warm the prejoin flow, and only then start the live WebRTC session.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading invite metadata…</p>
          ) : (
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>Room: {invite?.roomId}</p>
              <p>Role: {invite?.role}</p>
              <p>Invite expires: {invite?.expiresAt}</p>
            </div>
          )}
        </CardContent>
      </Card>

      <PrejoinModal open={!loading && Boolean(invite)} loading={joining} onJoin={handleJoin} />
    </main>
  )
}
