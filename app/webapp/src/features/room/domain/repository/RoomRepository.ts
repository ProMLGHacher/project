import type { PromiseResult } from '@kvt/core'

import type { JoinRoomError, JoinRoomParams, JoinRoomResult } from '../model/JoinRoom'
import type { GetRoomError, GetRoomParams, RoomMetadata } from '../model/Room'
import type { CreateRoomError, CreateRoomResult } from '../model/CreateRoom'

export interface RoomRepository {
  joinRoom(params: JoinRoomParams): PromiseResult<JoinRoomResult, JoinRoomError>
  createRoom(): PromiseResult<CreateRoomResult, CreateRoomError>
  getRoom(params: GetRoomParams): PromiseResult<RoomMetadata, GetRoomError>
}
