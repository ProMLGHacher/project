import type { PromiseResult, UseCase } from '@kvt/core'

import type { JoinRoomError, JoinRoomParams, JoinRoomResult } from '../model/JoinRoom'
import type { RoomRepository } from '../repository/RoomRepository'

export class JoinRoomUseCase implements UseCase<
  JoinRoomParams,
  PromiseResult<JoinRoomResult, JoinRoomError>
> {
  constructor(private readonly roomRepository: RoomRepository) {}

  execute(params: JoinRoomParams): PromiseResult<JoinRoomResult, JoinRoomError> {
    return this.roomRepository.joinRoom(params)
  }
}
