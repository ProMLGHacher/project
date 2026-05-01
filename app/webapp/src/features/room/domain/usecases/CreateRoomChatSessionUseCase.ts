import type { PromiseResult, UseCase } from '@kvt/core'
import type {
  CreateRoomChatSessionParams,
  RoomChatSessionError,
  RoomChatSessionResult
} from '../model/RoomChatSession'
import type { RoomRepository } from '../repository/RoomRepository'

export class CreateRoomChatSessionUseCase
  implements
    UseCase<CreateRoomChatSessionParams, PromiseResult<RoomChatSessionResult, RoomChatSessionError>>
{
  constructor(private readonly roomRepository: RoomRepository) {}

  execute(
    params: CreateRoomChatSessionParams
  ): PromiseResult<RoomChatSessionResult, RoomChatSessionError> {
    return this.roomRepository.createRoomChatSession(params)
  }
}
