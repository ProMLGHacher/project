import { createToken } from '@kvt/core'
import type { RecentRoomsRepository } from './RecentRoomsRepository'

export const recentRoomsRepositoryToken =
  createToken<RecentRoomsRepository>('RecentRoomsRepository')
