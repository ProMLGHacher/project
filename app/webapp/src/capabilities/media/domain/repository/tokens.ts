import { createToken } from '@kvt/core'
import type { LocalPreviewRepository } from './LocalPreviewRepository'
import type { MediaDeviceRepository } from './MediaDeviceRepository'
import type { ScreenShareRepository } from './ScreenShareRepository'

export const mediaDeviceRepositoryToken =
  createToken<MediaDeviceRepository>('MediaDeviceRepository')

export const localPreviewRepositoryToken =
  createToken<LocalPreviewRepository>('LocalPreviewRepository')

export const screenShareRepositoryToken =
  createToken<ScreenShareRepository>('ScreenShareRepository')
