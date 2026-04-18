import type { JoinResponse } from '@/features/protocol/types'

const SESSION_PREFIX = 'voice-first-sfu:session:'

export interface StoredJoinSession extends JoinResponse {
  roomJoinUrl?: string
}

type LocationLike = Pick<Location, 'origin' | 'protocol'>

export function storeJoinSession(session: JoinResponse, locationLike: LocationLike = window.location) {
  const storedSession = normalizeStoredJoinSession({
    ...session,
    roomJoinUrl: `${locationLike.origin}/rooms/${session.roomId}/join`
  }, locationLike)

  sessionStorage.setItem(SESSION_PREFIX + session.roomId, JSON.stringify(storedSession))
}

export function loadJoinSession(roomId: string, locationLike: LocationLike = window.location): StoredJoinSession | null {
  const raw = sessionStorage.getItem(SESSION_PREFIX + roomId)
  if (!raw) {
    return null
  }

  try {
    const parsed = JSON.parse(raw) as StoredJoinSession
    const normalized = normalizeStoredJoinSession(parsed, locationLike)
    if (normalized.wsUrl !== parsed.wsUrl) {
      sessionStorage.setItem(SESSION_PREFIX + roomId, JSON.stringify(normalized))
    }
    return normalized
  } catch {
    return null
  }
}

export function clearJoinSession(roomId: string) {
  sessionStorage.removeItem(SESSION_PREFIX + roomId)
}

export function normalizeSessionWebSocketURL(wsUrl: string, locationLike: LocationLike = window.location) {
  try {
    const resolved = new URL(wsUrl, locationLike.origin)

    if (locationLike.protocol === 'https:' && resolved.protocol === 'ws:') {
      resolved.protocol = 'wss:'
    }

    return resolved.toString()
  } catch {
    return wsUrl
  }
}

function normalizeStoredJoinSession(session: StoredJoinSession, locationLike: LocationLike) {
  return {
    ...session,
    wsUrl: normalizeSessionWebSocketURL(session.wsUrl, locationLike)
  }
}
