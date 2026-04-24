import { err, ok, type PromiseResult } from '@kvt/core'
import type {
  JoinSession,
  SessionError,
  StoredJoinSession
} from '@capabilities/session/domain/model/JoinSession'
import type { JoinSessionRepository } from '@capabilities/session/domain/repository/JoinSessionRepository'

const storagePrefix = 'kvt.rooms.join-session:'

export class LocalStorageJoinSessionRepository implements JoinSessionRepository {
  async save(session: JoinSession): PromiseResult<void, SessionError> {
    localStorage.setItem(
      keyFor(session.roomId),
      JSON.stringify({ ...session, storedAt: new Date().toISOString() })
    )
    return ok()
  }

  async load(roomId: string): PromiseResult<StoredJoinSession, SessionError> {
    const stored = localStorage.getItem(keyFor(roomId))
    if (!stored) {
      return err({ type: 'not-found' })
    }

    try {
      return ok<StoredJoinSession>(JSON.parse(stored))
    } catch {
      return err({ type: 'unknown-error', message: 'Stored session is invalid' })
    }
  }

  async clear(roomId: string): PromiseResult<void, SessionError> {
    localStorage.removeItem(keyFor(roomId))
    return ok()
  }
}

function keyFor(roomId: string): string {
  return `${storagePrefix}${roomId}`
}
