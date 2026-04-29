export type JoinSessionParticipantRole = 'host' | 'participant'

export type JoinSessionIceServer = {
  readonly credential?: string
  readonly urls: readonly string[]
  readonly username?: string
}

export type JoinSessionParticipantSlotKind = 'audio' | 'camera' | 'screen' | 'screenAudio'

export type JoinSessionParticipantSlot = {
  readonly enabled: boolean
  readonly kind: JoinSessionParticipantSlotKind
  readonly publishing: boolean
  readonly revision: number
  readonly trackBound: boolean
}

export type JoinSessionParticipant = {
  readonly displayName: string
  readonly id: string
  readonly role: JoinSessionParticipantRole
  readonly slots: readonly JoinSessionParticipantSlot[]
}

export type JoinSessionSnapshot = {
  readonly hostParticipantId: string
  readonly participants: readonly JoinSessionParticipant[]
  readonly roomId: string
}

export type JoinSession = {
  readonly iceServers: readonly JoinSessionIceServer[]
  readonly participantId: string
  readonly role: JoinSessionParticipantRole
  readonly roomId: string
  readonly sessionId: string
  readonly snapshot: JoinSessionSnapshot
  readonly wsUrl: string
}

export type StoredJoinSession = JoinSession & {
  readonly storedAt: string
}

export type SessionError =
  | { readonly type: 'not-found' }
  | { readonly type: 'expired' }
  | { readonly type: 'unknown-error'; readonly message?: string }
