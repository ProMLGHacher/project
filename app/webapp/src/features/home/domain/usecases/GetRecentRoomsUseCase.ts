import type { UseCase } from '@kvt/core'
import type { RecentRoom } from '../model/RecentRoom'
import type { RecentRoomsRepository } from '../repository/RecentRoomsRepository'

export class GetRecentRoomsUseCase implements UseCase<void, Promise<readonly RecentRoom[]>> {
  constructor(private readonly repository: RecentRoomsRepository) {}

  execute(): Promise<readonly RecentRoom[]> {
    return this.repository.getRecentRooms()
  }
}
