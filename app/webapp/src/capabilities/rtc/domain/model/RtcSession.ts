export type RtcConnectionStatus =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'failed'
  | 'closed'

export type RtcPeerKind = 'publisher' | 'subscriber'

export type RtcMediaSlotKind = 'audio' | 'camera' | 'screen' | 'screenAudio'

export type RtcMediaSlot = {
  readonly participantId: string
  readonly kind: RtcMediaSlotKind
  readonly enabled: boolean
  readonly publishing: boolean
  readonly trackBound: boolean
  readonly revision: number
}

export type RtcParticipantRole = 'host' | 'participant'

export type RtcParticipant = {
  readonly id: string
  readonly displayName: string
  readonly role: RtcParticipantRole
  readonly slots: readonly RtcMediaSlot[]
}

export type RtcRoomSnapshot = {
  readonly roomId: string
  readonly hostParticipantId: string
  readonly participants: readonly RtcParticipant[]
}

export type RtcMediaStreams = Partial<Record<RtcMediaSlotKind, MediaStream>>

export type RtcSession = {
  readonly roomId: string
  readonly participantId: string
  readonly status: RtcConnectionStatus
  readonly snapshot: RtcRoomSnapshot | null
  readonly localMediaStreams: RtcMediaStreams
  readonly remoteMediaStreams: Readonly<Record<string, RtcMediaStreams>>
}

export type RtcDiagnostics = {
  readonly signalingState: string
  readonly publisherConnectionState: string
  readonly publisherIceState: string
  readonly subscriberConnectionState: string
  readonly subscriberIceState: string
  readonly recentSignalsSent: readonly string[]
  readonly recentSignalsReceived: readonly string[]
  readonly lastError: string | null
}
