import axios from 'axios'
import type {
  CreateRoomResponse,
  InviteMetadata,
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
  async getInvite(token: string) {
    const { data } = await api.get<InviteMetadata>(`/api/invites/${token}`)
    return data
  },
  async joinInvite(token: string, payload: JoinRequest) {
    const { data } = await api.post<JoinResponse>(`/api/invites/${token}/join`, payload)
    return data
  }
}
