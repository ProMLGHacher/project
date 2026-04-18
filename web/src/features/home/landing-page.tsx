import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Mic, Plus, Video } from 'lucide-react'
import { conferenceApi } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'

export function LandingPage() {
  const navigate = useNavigate()
  const [roomInput, setRoomInput] = useState('')
  const [creatingRoom, setCreatingRoom] = useState(false)

  async function handleCreateRoom() {
    setCreatingRoom(true)
    try {
      const room = await conferenceApi.createRoom()
      navigate(`/rooms/${room.roomId}/join?role=host`)
    } finally {
      setCreatingRoom(false)
    }
  }

  function handleJoinByRoomID(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const roomId = extractRoomId(roomInput)
    if (!roomId) {
      return
    }
    navigate(`/rooms/${roomId}/join`)
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-7xl flex-col justify-center px-6 py-16">
      <div className="grid gap-8 lg:grid-cols-[1.2fr,0.8fr]">
        <section className="rounded-[36px] border border-border/50 bg-white/70 p-8 shadow-xl backdrop-blur lg:p-12">
          <Badge className="bg-accent text-accent-foreground">Voice-first conferencing</Badge>
          <h1 className="mt-6 max-w-2xl font-display text-4xl font-bold tracking-tight text-slate-900 lg:text-6xl">
            Fast room entry, stable audio, seamless camera and screen share renegotiation.
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-slate-600">
            A Discord-style join flow on top of a custom SFU: one publisher connection, one subscriber connection,
            and audio continuity as the primary product promise.
          </p>
          <div className="mt-8 flex flex-wrap gap-3 text-sm text-slate-600">
            <Badge>Single-node SFU</Badge>
            <Badge>Room id + name</Badge>
            <Badge>TURN-ready</Badge>
            <Badge>Desktop Chromium first</Badge>
          </div>
        </section>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Create a room</CardTitle>
              <CardDescription>Create a room id and go straight into the host prejoin experience.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button className="w-full justify-between" size="lg" onClick={handleCreateRoom} disabled={creatingRoom}>
                <span className="flex items-center gap-2">
                  <Plus className="h-4 w-4" />
                  Create room
                </span>
                <span>{creatingRoom ? 'Creating…' : 'Start now'}</span>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Join by room id</CardTitle>
              <CardDescription>Paste the room id or the full room join URL.</CardDescription>
            </CardHeader>
            <CardContent>
              <form className="space-y-4" onSubmit={handleJoinByRoomID}>
                <Input
                  placeholder="cda7fc49-42e1-4a64-a0bc-b157071c15c3 or https://kvt.araik.dev/rooms/<id>/join"
                  value={roomInput}
                  onChange={(event) => setRoomInput(event.target.value)}
                />
                <Button className="w-full" type="submit" variant="secondary">
                  Join room
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card className="bg-slate-950 text-white">
            <CardHeader>
              <CardTitle className="text-white">Voice-first defaults</CardTitle>
              <CardDescription className="text-slate-300">
                Microphone is always the protected path. Camera and screen share can appear later without replacing the whole session.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-3 gap-3">
              <FeaturePill icon={<Mic className="h-4 w-4" />} label="Mic toggle via enabled" />
              <FeaturePill icon={<Video className="h-4 w-4" />} label="Reserved camera slot" />
              <FeaturePill icon={<Plus className="h-4 w-4" />} label="ICE restart fallback" />
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  )
}

function extractRoomId(input: string) {
  const trimmed = input.trim()
  if (!trimmed) {
    return ''
  }

  const roomJoinMatch = trimmed.match(/\/rooms\/([^/?#]+)(?:\/join)?/)
  return roomJoinMatch?.[1] ?? trimmed
}

function FeaturePill({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-3 text-center text-xs text-slate-100">
      <div className="mb-2 flex justify-center">{icon}</div>
      {label}
    </div>
  )
}
