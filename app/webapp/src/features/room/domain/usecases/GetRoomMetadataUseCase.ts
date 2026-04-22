import type { PromiseResult, UseCase } from '@kvt/core'

import type { GetRoomError, GetRoomParams, RoomMetadata } from '../model/Room'
import type { RoomRepository } from '../repository/RoomRepository'

export class GetRoomMetadataUseCase implements UseCase<
  GetRoomParams,
  PromiseResult<RoomMetadata, GetRoomError>
> {
  constructor(private readonly roomRepository: RoomRepository) {}

  execute(params: GetRoomParams): PromiseResult<RoomMetadata, GetRoomError> {
    return this.roomRepository.getRoom(params)
  }
}
