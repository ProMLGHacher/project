import type { NoInputUseCase, PromiseResult } from '@kvt/core'
import type { CreateRoomError, CreateRoomResult } from '../model/CreateRoom'
import type { RoomRepository } from '../repository/RoomRepository'

export class CreateRoomUseCase implements NoInputUseCase<
  PromiseResult<CreateRoomResult, CreateRoomError>
> {
  constructor(private readonly roomRepository: RoomRepository) {}

  execute(): PromiseResult<CreateRoomResult, CreateRoomError> {
    return this.roomRepository.createRoom()
  }
}
