import type { ParticipantState } from '@/features/protocol/types'
import { applySlotPatch, type ParticipantMap } from '@/features/room/room-page'

describe('applySlotPatch', () => {
  it('updates only the targeted participant slot', () => {
    const participants: ParticipantMap = {
      'participant-1': {
        id: 'participant-1',
        displayName: 'Araik',
        role: 'participant',
        slots: [
          { kind: 'audio', enabled: true, publishing: true, trackBound: true, revision: 1 },
          { kind: 'camera', enabled: false, publishing: false, trackBound: false, revision: 1 },
          { kind: 'screen', enabled: false, publishing: false, trackBound: false, revision: 1 }
        ]
      } satisfies ParticipantState
    }

    const next = applySlotPatch(participants, {
      participantId: 'participant-1',
      kind: 'camera',
      enabled: true,
      publishing: true,
      trackBound: true
    })

    expect(next['participant-1'].slots.find((slot) => slot.kind === 'camera')?.enabled).toBe(true)
    expect(next['participant-1'].slots.find((slot) => slot.kind === 'camera')?.revision).toBe(2)
  })
})
