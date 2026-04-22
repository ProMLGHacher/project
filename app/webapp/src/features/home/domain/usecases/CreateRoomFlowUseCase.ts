import { type NoInputUseCase, type PromiseResult } from '@kvt/core'
import type { CreateRoomUseCase } from '@features/room/domain/usecases/CreateRoomUseCase'
import type { CreateRoomFlowError, CreateRoomFlowResult } from '../model/CreateRoomFlow'

export class CreateRoomFlowUseCase implements NoInputUseCase<
  PromiseResult<CreateRoomFlowResult, CreateRoomFlowError>
> {
  constructor(private readonly createRoomUseCase: CreateRoomUseCase) {}

  async execute(): PromiseResult<CreateRoomFlowResult, CreateRoomFlowError> {
    return this.createRoomUseCase.execute()
  }
}
