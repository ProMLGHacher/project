import axios from 'axios'
import type {
  CreateRoomResponse,
  RoomMetadata,
  JoinRequest,
  JoinResponse
} from '@/features/protocol/types'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? ''
})

export const conferenceApi = {
  async createRoom() {
    const { data } = await api.post<CreateRoomResponse>('/api/rooms')
    return data
  },
  async getRoom(roomId: string) {
    const { data } = await api.get<RoomMetadata>(`/api/rooms/${roomId}`)
    return data
  },
  async joinRoom(roomId: string, payload: JoinRequest) {
    const { data } = await api.post<JoinResponse>(`/api/rooms/${roomId}/join`, payload)
    return data
  }
}
