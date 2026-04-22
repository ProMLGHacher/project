import type { Participant, ParticipantRole } from './Participant'

export type JoinRoomParams = {
  roomId: string
  displayName: string
  cameraEnabled: boolean
  micEnabled: boolean
  role: ParticipantRole
}

export type JoinRoomResult = {
  iceServers: JoinRoomIceServer[]
  participantId: string
  role: ParticipantRole
  roomId: string
  sessionId: string
  snapshot: JoinRoomSnapshot
  wsUrl: string
}

export type JoinRoomError = { type: 'unknown-error' } | { type: 'room-not-found' }

export type JoinRoomIceServer = {
  credential: string
  urls: string[]
  username: string
}

export type JoinRoomSnapshot = {
  hostParticipantId: string
  participants: Participant[]
  roomId: string
}
