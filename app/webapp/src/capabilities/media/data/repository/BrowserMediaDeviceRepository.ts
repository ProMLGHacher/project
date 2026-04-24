import { MutableStateFlow, err, ok, type PromiseResult } from '@kvt/core'
import type {
  MediaDevice,
  MediaError,
  MediaPermissionState
} from '@capabilities/media/domain/model'
import type { MediaDeviceRepository } from '@capabilities/media/domain/repository/MediaDeviceRepository'

export class BrowserMediaDeviceRepository implements MediaDeviceRepository {
  private readonly permission = new MutableStateFlow<MediaPermissionState>('unknown')
  readonly permissionState = this.permission.asStateFlow()

  async listDevices(): PromiseResult<readonly MediaDevice[], MediaError> {
    if (!navigator.mediaDevices?.enumerateDevices) {
      return ok(fallbackDevices)
    }

    try {
      const devices = await navigator.mediaDevices.enumerateDevices()
      const mapped = devices.map<MediaDevice>((device) => ({
        id: device.deviceId,
        label: device.label || fallbackLabel(device.kind),
        kind: mapDeviceKind(device.kind),
        groupId: device.groupId || undefined
      }))

      return ok(mapped.length ? mapped : fallbackDevices)
    } catch (error) {
      return err(toMediaError(error))
    }
  }

  async requestAudioPermission(): PromiseResult<void, MediaError> {
    return this.requestPermission({ audio: true, video: false })
  }

  async requestVideoPermission(): PromiseResult<void, MediaError> {
    return this.requestPermission({ audio: false, video: true })
  }

  private async requestPermission(
    constraints: MediaStreamConstraints
  ): PromiseResult<void, MediaError> {
    if (!navigator.mediaDevices?.getUserMedia) {
      this.permission.set('unavailable')
      return err({ type: 'api-unavailable' })
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia(constraints)
      stream.getTracks().forEach((track) => track.stop())
      this.permission.set('granted')
      return ok()
    } catch (error) {
      this.permission.set('denied')
      return err(toMediaError(error))
    }
  }
}

const fallbackDevices: readonly MediaDevice[] = [
  { id: 'default-microphone', kind: 'audio-input', label: 'Default microphone' },
  { id: 'default-camera', kind: 'video-input', label: 'Default camera' }
]

function fallbackLabel(kind: MediaDeviceInfo['kind']): string {
  if (kind === 'audioinput') return 'Microphone'
  if (kind === 'videoinput') return 'Camera'
  return 'Speaker'
}

function mapDeviceKind(kind: MediaDeviceInfo['kind']): MediaDevice['kind'] {
  if (kind === 'audioinput') return 'audio-input'
  if (kind === 'videoinput') return 'video-input'
  return 'audio-output'
}

function toMediaError(error: unknown): MediaError {
  if (error instanceof DOMException && error.name === 'NotAllowedError') {
    return { type: 'permission-denied' }
  }
  if (error instanceof DOMException && error.name === 'NotFoundError') {
    return { type: 'device-not-found' }
  }
  return { type: 'unknown-error', message: error instanceof Error ? error.message : undefined }
}
