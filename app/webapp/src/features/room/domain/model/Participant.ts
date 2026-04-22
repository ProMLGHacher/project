export type ParticipantRole = 'host' | 'participant'

export type ParticipantSlotKind = 'audio' | 'video'

export type ParticipantSlot = {
  enabled: boolean
  kind: ParticipantSlotKind
  publishing: boolean
  revision: number
  trackBound: boolean
}

export type Participant = {
  displayName: string
  id: string
  role: ParticipantRole
  slots: ParticipantSlot[]
}
