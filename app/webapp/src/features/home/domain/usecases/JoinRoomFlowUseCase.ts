import { err, ok, type PromiseResult, type UseCase } from '@kvt/core'
import type {
  JoinRoomFlowError,
  JoinRoomFlowParams,
  JoinRoomFlowResult
} from '../model/JoinRoomFlow'
import type { RoomExistsByIdUseCase } from '@features/room/domain/usecases/RoomExistsByIdUseCase'

export class JoinRoomFlowUseCase implements UseCase<
  JoinRoomFlowParams,
  PromiseResult<JoinRoomFlowResult, JoinRoomFlowError>
> {
  constructor(private readonly checkRoomExistsUseCase: RoomExistsByIdUseCase) {}

  async execute(params: JoinRoomFlowParams): PromiseResult<JoinRoomFlowResult, JoinRoomFlowError> {
    const roomExists = await this.checkRoomExistsUseCase.execute({ roomId: params.roomId })
    if (roomExists.ok) {
      if (roomExists.value.exists) {
        return ok({ roomId: params.roomId })
      } else {
        return err({ type: 'room-not-found' })
      }
    } else {
      return err({ type: 'unknown-error' })
    }
  }
}
