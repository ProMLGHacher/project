import type { PromiseResult } from '@kvt/core'

import type { JoinRoomError, JoinRoomParams, JoinRoomResult } from '../model/JoinRoom'
import type {
  CreateRoomChatSessionParams,
  RoomChatSessionError,
  RoomChatSessionResult
} from '../model/RoomChatSession'
import type { GetRoomError, GetRoomParams, RoomMetadata } from '../model/Room'
import type { CreateRoomError, CreateRoomResult } from '../model/CreateRoom'
import type { RoomExistsByIdParams } from '../model/RoomExistsById'

export interface RoomRepository {
  joinRoom(params: JoinRoomParams): PromiseResult<JoinRoomResult, JoinRoomError>
  createRoomChatSession(
    params: CreateRoomChatSessionParams
  ): PromiseResult<RoomChatSessionResult, RoomChatSessionError>
  createRoom(): PromiseResult<CreateRoomResult, CreateRoomError>
  getRoom(params: GetRoomParams): PromiseResult<RoomMetadata, GetRoomError>
  roomExists(params: RoomExistsByIdParams): PromiseResult<boolean, { type: 'unknown-error' }>
}
