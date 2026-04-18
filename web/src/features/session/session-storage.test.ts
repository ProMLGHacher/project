import { beforeEach, describe, expect, it } from 'vitest'
import {
  clearJoinSession,
  loadJoinSession,
  normalizeSessionWebSocketURL,
  storeJoinSession
} from '@/features/session/session-storage'

describe('session storage', () => {
  const session = {
    sessionId: 'session-1',
    participantId: 'participant-1',
    roomId: 'room-1',
    role: 'host' as const,
    wsUrl: 'ws://kvt.araik.dev/ws?sessionId=session-1',
    iceServers: [],
    snapshot: {
      roomId: 'room-1',
      hostParticipantId: 'participant-1',
      participants: []
    }
  }

  beforeEach(() => {
    sessionStorage.clear()
  })

  it('upgrades insecure websocket URLs to wss on https pages', () => {
    expect(
      normalizeSessionWebSocketURL('ws://kvt.araik.dev/ws?sessionId=session-1', {
        origin: 'https://kvt.araik.dev',
        protocol: 'https:'
      })
    ).toBe('wss://kvt.araik.dev/ws?sessionId=session-1')
  })

  it('keeps ws URLs unchanged on http pages', () => {
    expect(
      normalizeSessionWebSocketURL('ws://localhost:8023/ws?sessionId=session-1', {
        origin: 'http://localhost:8023',
        protocol: 'http:'
      })
    ).toBe('ws://localhost:8023/ws?sessionId=session-1')
  })

  it('normalizes stored room sessions when loading older saved data', () => {
    storeJoinSession(
      session,
      {
        origin: 'http://kvt.araik.dev',
        protocol: 'http:'
      }
    )

    const loaded = loadJoinSession('room-1', {
      origin: 'https://kvt.araik.dev',
      protocol: 'https:'
    })

    expect(loaded?.wsUrl).toBe('wss://kvt.araik.dev/ws?sessionId=session-1')

    clearJoinSession('room-1')
  })
})
