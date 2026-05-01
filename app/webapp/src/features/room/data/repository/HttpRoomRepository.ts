import { err, ok, type PromiseResult } from '@kvt/core'
import type { CreateRoomError, CreateRoomResult } from '@features/room/domain/model/CreateRoom'
import type {
  JoinRoomError,
  JoinRoomParams,
  JoinRoomResult
} from '@features/room/domain/model/JoinRoom'
import type {
  CreateRoomChatSessionParams,
  RoomChatSessionError,
  RoomChatSessionResult
} from '@features/room/domain/model/RoomChatSession'
import type { GetRoomError, GetRoomParams, RoomMetadata } from '@features/room/domain/model/Room'
import type { RoomExistsByIdParams } from '@features/room/domain/model/RoomExistsById'
import type { RoomRepository } from '@features/room/domain/repository/RoomRepository'

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? ''

export class HttpRoomRepository implements RoomRepository {
  async createRoom(): PromiseResult<CreateRoomResult, CreateRoomError> {
    try {
      return ok(await request<CreateRoomResult>('/api/rooms', { method: 'POST' }))
    } catch {
      return err({ type: 'unknown-error' })
    }
  }

  async getRoom(params: GetRoomParams): PromiseResult<RoomMetadata, GetRoomError> {
    try {
      return ok(await request<RoomMetadata>(`/api/rooms/${params.roomId}`))
    } catch (error) {
      return err(isHttpStatus(error, 404) ? { type: 'room-not-found' } : { type: 'unknown-error' })
    }
  }

  async roomExists(
    params: RoomExistsByIdParams
  ): PromiseResult<boolean, { type: 'unknown-error' }> {
    try {
      await request<RoomMetadata>(`/api/rooms/${params.roomId}`)
      return ok(true)
    } catch (error) {
      if (isHttpStatus(error, 404)) {
        return ok(false)
      }
      return err({ type: 'unknown-error' })
    }
  }

  async joinRoom(params: JoinRoomParams): PromiseResult<JoinRoomResult, JoinRoomError> {
    try {
      return ok(
        await request<JoinRoomResult>(`/api/rooms/${params.roomId}/join`, {
          method: 'POST',
          body: JSON.stringify({
            displayName: params.displayName,
            micEnabled: params.micEnabled,
            cameraEnabled: params.cameraEnabled,
            role: params.role
          })
        })
      )
    } catch (error) {
      return err(isHttpStatus(error, 404) ? { type: 'room-not-found' } : { type: 'unknown-error' })
    }
  }

  async createRoomChatSession(
    params: CreateRoomChatSessionParams
  ): PromiseResult<RoomChatSessionResult, RoomChatSessionError> {
    try {
      return ok(
        await request<RoomChatSessionResult>(`/api/rooms/${params.roomId}/chat/session`, {
          method: 'POST',
          body: JSON.stringify({
            displayName: params.displayName,
            role: 'participant'
          })
        })
      )
    } catch (error) {
      return err(isHttpStatus(error, 404) ? { type: 'room-not-found' } : { type: 'unknown-error' })
    }
  }
}

async function request<TResponse>(path: string, init: RequestInit = {}): Promise<TResponse> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...init.headers
    }
  })

  if (!response.ok) {
    throw new HttpError(response.status)
  }

  return (await response.json()) as TResponse
}

class HttpError extends Error {
  constructor(readonly status: number) {
    super(`HTTP ${status}`)
  }
}

function isHttpStatus(error: unknown, status: number): boolean {
  return error instanceof HttpError && error.status === status
}
