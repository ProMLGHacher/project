import type { RecentRoom } from '../domain/model/RecentRoom'
import type { RecentRoomsRepository } from '../domain/repository/RecentRoomsRepository'

const storageKey = 'kvatum.home.recent-rooms'
const recentLimit = 5

export class LocalStorageRecentRoomsRepository implements RecentRoomsRepository {
  async getRecentRooms(): Promise<readonly RecentRoom[]> {
    return this.read()
  }

  async saveVisit(roomId: string): Promise<readonly RecentRoom[]> {
    const trimmedRoomId = roomId.trim()
    if (!trimmedRoomId) {
      return this.read()
    }

    const next = [
      { roomId: trimmedRoomId, visitedAt: new Date().toISOString() },
      ...this.read().filter((room) => room.roomId !== trimmedRoomId)
    ].slice(0, recentLimit)

    this.write(next)
    return next
  }

  private read(): readonly RecentRoom[] {
    if (typeof localStorage === 'undefined') {
      return []
    }

    try {
      const stored = localStorage.getItem(storageKey)
      if (!stored) {
        return []
      }
      const parsed = JSON.parse(stored) as readonly Partial<RecentRoom>[]
      return parsed
        .filter((room): room is RecentRoom => Boolean(room.roomId && room.visitedAt))
        .slice(0, recentLimit)
    } catch {
      return []
    }
  }

  private write(rooms: readonly RecentRoom[]) {
    if (typeof localStorage === 'undefined') {
      return
    }

    localStorage.setItem(storageKey, JSON.stringify(rooms))
  }
}
