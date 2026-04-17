import { render, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const loadJoinSessionMock = vi.fn()
const startMock = vi.fn()
const closeMock = vi.fn()
const setMicEnabledMock = vi.fn()
const setCameraEnabledMock = vi.fn()
const setScreenEnabledMock = vi.fn()
const conferenceClientCtor = vi.fn()

vi.mock('@/features/session/session-storage', () => ({
  loadJoinSession: (...args: unknown[]) => loadJoinSessionMock(...args)
}))

vi.mock('@/lib/rtc/conference-client', () => ({
  ConferenceClient: function MockConferenceClient(...args: unknown[]) {
    conferenceClientCtor(...args)
    return {
      start: startMock,
      close: closeMock,
      setMicEnabled: setMicEnabledMock,
      setCameraEnabled: setCameraEnabledMock,
      setScreenEnabled: setScreenEnabledMock
    }
  }
}))

import { RoomPage } from '@/features/room/room-page'

describe('RoomPage lifecycle', () => {
  beforeEach(() => {
    loadJoinSessionMock.mockReset()
    conferenceClientCtor.mockReset()
    startMock.mockReset().mockResolvedValue(undefined)
    closeMock.mockReset()
    setMicEnabledMock.mockReset()
    setCameraEnabledMock.mockReset()
    setScreenEnabledMock.mockReset()

    loadJoinSessionMock.mockImplementation(() => ({
      sessionId: crypto.randomUUID(),
      participantId: 'participant-1',
      roomId: 'room-1',
      role: 'host',
      wsUrl: 'ws://localhost/ws?sessionId=session-1',
      iceServers: [],
      snapshot: {
        roomId: 'room-1',
        hostParticipantId: 'participant-1',
        participants: [
          {
            id: 'participant-1',
            displayName: 'Host',
            role: 'host',
            slots: [
              { kind: 'audio', enabled: true, publishing: true, trackBound: true, revision: 1 },
              { kind: 'camera', enabled: false, publishing: false, trackBound: false, revision: 1 },
              { kind: 'screen', enabled: false, publishing: false, trackBound: false, revision: 1 }
            ]
          }
        ]
      }
    }))
  })

  it('keeps the same room session object across rerenders for the same room id', async () => {
    const tree = (
      <MemoryRouter initialEntries={['/rooms/room-1']}>
        <Routes>
          <Route path="/rooms/:roomId" element={<RoomPage />} />
        </Routes>
      </MemoryRouter>
    )

    const { rerender } = render(tree)

    await waitFor(() => {
      expect(startMock).toHaveBeenCalledTimes(1)
    })

    rerender(tree)

    await waitFor(() => {
      expect(loadJoinSessionMock).toHaveBeenCalledTimes(1)
      expect(conferenceClientCtor).toHaveBeenCalledTimes(1)
      expect(startMock).toHaveBeenCalledTimes(1)
    })
  })
})
