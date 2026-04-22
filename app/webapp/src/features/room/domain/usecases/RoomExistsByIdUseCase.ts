import { err, ok, type PromiseResult, type UseCase } from '@kvt/core'
import type { RoomExistsByIdError, RoomExistsByIdParams } from '../model/RoomExistsById'
import type { RoomExistsByIdResult } from '../model/RoomExistsById'
import type { RoomRepository } from '../repository/RoomRepository'

export class RoomExistsByIdUseCase implements UseCase<
  RoomExistsByIdParams,
  PromiseResult<RoomExistsByIdResult, RoomExistsByIdError>
> {
  constructor(private readonly roomRepository: RoomRepository) {}

  async execute(
    params: RoomExistsByIdParams
  ): PromiseResult<RoomExistsByIdResult, RoomExistsByIdError> {
    const room = await this.roomRepository.getRoom(params)

    if (room.ok) {
      return ok({ exists: true })
    } else {
      switch (room.error.type) {
        case 'room-not-found':
          return ok({ exists: false })
        default:
          return err({ type: 'unknown-error' })
      }
    }
  }
}
