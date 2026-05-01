import type { UseCase } from '@kvt/core'
import type { RecentRoom } from '../model/RecentRoom'
import type { RecentRoomsRepository } from '../repository/RecentRoomsRepository'

export class SaveRecentRoomVisitUseCase
  implements UseCase<{ readonly roomId: string }, Promise<readonly RecentRoom[]>>
{
  constructor(private readonly repository: RecentRoomsRepository) {}

  execute(params: { readonly roomId: string }): Promise<readonly RecentRoom[]> {
    return this.repository.saveVisit(params.roomId)
  }
}
