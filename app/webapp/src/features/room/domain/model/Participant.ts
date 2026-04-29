export type ParticipantRole = 'host' | 'participant'

export type ParticipantSlotKind = 'audio' | 'camera' | 'screen' | 'screenAudio'

export type ParticipantSlot = {
  readonly enabled: boolean
  readonly kind: ParticipantSlotKind
  readonly publishing: boolean
  readonly revision: number
  readonly trackBound: boolean
}

export type Participant = {
  readonly displayName: string
  readonly id: string
  readonly role: ParticipantRole
  readonly slots: readonly ParticipantSlot[]
}
