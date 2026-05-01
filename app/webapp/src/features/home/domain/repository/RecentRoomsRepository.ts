import type { RecentRoom } from '../model/RecentRoom'

export interface RecentRoomsRepository {
  getRecentRooms(): Promise<readonly RecentRoom[]>
  saveVisit(roomId: string): Promise<readonly RecentRoom[]>
}
