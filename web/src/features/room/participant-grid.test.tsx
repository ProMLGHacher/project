import { render } from '@testing-library/react'
import { ParticipantGrid } from '@/features/room/participant-grid'
import type { ParticipantState } from '@/features/protocol/types'

describe('ParticipantGrid', () => {
  it('renders screen share video when camera is off but screen is enabled', () => {
    const participants: ParticipantState[] = [
      {
        id: 'participant-1',
        displayName: 'Host Bot',
        role: 'host',
        slots: [
          { kind: 'audio', enabled: true, publishing: true, trackBound: true, revision: 1 },
          { kind: 'camera', enabled: false, publishing: false, trackBound: false, revision: 1 },
          { kind: 'screen', enabled: true, publishing: true, trackBound: true, revision: 1 }
        ]
      }
    ]

    const { container, queryByText } = render(
      <ParticipantGrid
        participants={participants}
        localParticipantId="participant-2"
        streams={{ 'participant-1': {} as MediaStream }}
      />
    )

    expect(container.querySelector('video')).not.toBeNull()
    expect(queryByText(/screen share ready/i)).toBeNull()
  })
})
