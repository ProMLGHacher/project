export type ParticipantRole = 'host' | 'participant'
export type SlotKind = 'audio' | 'camera' | 'screen' | 'screenAudio'
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

export interface ICEServerConfig {
  urls: string[]
  username?: string
  credential?: string
}

export interface SignalEnvelope<T = unknown> {
  type: string
  payload?: T
}

export interface SessionDescriptionPayload {
  peer: SignalPeer
  description: RTCSessionDescriptionInit
  slotBindings?: Record<string, SlotKind>
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
