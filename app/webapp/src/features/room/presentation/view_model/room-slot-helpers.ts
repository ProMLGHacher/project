import type { Participant, ParticipantSlotKind } from '@features/room/domain/model/Participant'
import type { RoomUiState } from '../model/RoomState'

export function updateLocalSlot(
  state: RoomUiState,
  kind: ParticipantSlotKind,
  enabled: boolean,
  publishing: boolean,
  trackBound = publishing
): readonly Participant[] {
  return state.participants.map((participant) => {
    if (participant.id !== state.localParticipantId) {
      return participant
    }

    return {
      ...participant,
      slots: participant.slots.map((slot) =>
        slot.kind === kind
          ? {
              ...slot,
              enabled,
              publishing,
              trackBound,
              revision: slot.revision + 1
            }
          : slot
      )
    }
  })
}

export function hasEnabledSlot(
  participants: readonly Participant[],
  participantId: string,
  kind: ParticipantSlotKind
): boolean {
  return (
    participants
      .find((participant) => participant.id === participantId)
      ?.slots.some((slot) => slot.kind === kind && slot.enabled) ?? false
  )
}

export function participantHasEnabledSlot(
  participant: Participant,
  kind: ParticipantSlotKind
): boolean {
  return participant.slots.some((slot) => slot.kind === kind && slot.enabled)
}

export function participantsById(participants: readonly Participant[]): Map<string, Participant> {
  return new Map(participants.map((participant) => [participant.id, participant]))
}
