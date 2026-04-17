import type { JoinResponse } from '@/features/protocol/types'

const SESSION_PREFIX = 'voice-first-sfu:session:'

export interface StoredJoinSession extends JoinResponse {
  inviteToken?: string
}

export function storeJoinSession(session: JoinResponse, inviteToken: string) {
  const storedSession: StoredJoinSession = {
    ...session,
    inviteToken
  }
  sessionStorage.setItem(SESSION_PREFIX + session.roomId, JSON.stringify(storedSession))
}

export function loadJoinSession(roomId: string): StoredJoinSession | null {
  const raw = sessionStorage.getItem(SESSION_PREFIX + roomId)
  if (!raw) {
    return null
  }

  try {
    return JSON.parse(raw) as StoredJoinSession
  } catch {
    return null
  }
}
