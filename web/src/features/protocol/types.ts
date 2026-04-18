export type ParticipantRole = 'host' | 'participant'
export type SlotKind = 'audio' | 'camera' | 'screen'
export type SignalPeer = 'publisher' | 'subscriber'

export interface SlotState {
  kind: SlotKind
  enabled: boolean
  publishing: boolean
  trackBound: boolean
  revision: number
}

export interface ParticipantState {
  id: string
  displayName: string
  role: ParticipantRole
  slots: SlotState[]
}

export interface RoomSnapshot {
  roomId: string
  hostParticipantId: string
  participants: ParticipantState[]
}

export interface RoomMetadata {
  roomId: string
  hostParticipantId: string
  participantCount: number
  roles: ParticipantRole[]
}

export interface JoinRequest {
  displayName: string
  micEnabled: boolean
  cameraEnabled: boolean
  role?: ParticipantRole
}

export interface ICEServerConfig {
  urls: string[]
  username?: string
  credential?: string
}

export interface JoinResponse {
  sessionId: string
  participantId: string
  roomId: string
  role: ParticipantRole
  wsUrl: string
  iceServers: ICEServerConfig[]
  snapshot: RoomSnapshot
}

export interface CreateRoomResponse {
  roomId: string
}

export interface SignalEnvelope<T = unknown> {
  type: string
  payload?: T
}

export interface SessionDescriptionPayload {
  peer: SignalPeer
  description: RTCSessionDescriptionInit
}

export interface CandidatePayload {
  peer: SignalPeer
  candidate: RTCIceCandidateInit
}

export interface SlotUpdatedPayload {
  participantId: string
  kind: SlotKind
  enabled: boolean
  publishing: boolean
  trackBound: boolean
}

export interface RoomSnapshotPayload {
  snapshot: RoomSnapshot
}

export interface IceRestartPayload {
  peer: SignalPeer
}

export interface ErrorPayload {
  message: string
}

export interface HeartbeatPayload {
  timestamp: number
}
