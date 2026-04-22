import type { ParticipantRole } from './Participant'

export type GetRoomParams = {
  roomId: string
}

export type RoomMetadata = {
  hostParticipantId: string
  participantCount: number
  roles: ParticipantRole[]
  roomId: string
}

export type GetRoomError = { type: 'room-not-found' } | { type: 'unknown-error' }
