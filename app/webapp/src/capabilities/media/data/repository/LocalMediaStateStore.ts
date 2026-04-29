import { MutableStateFlow } from '@kvt/core'
import type { LocalMediaState } from '@capabilities/media/domain/model'

type LocalMediaTrack = LocalMediaState['tracks'][number]

export const createInitialTracks = (): LocalMediaTrack[] => [
  { kind: 'audio', enabled: true, available: true, deviceId: null, label: null },
  { kind: 'camera', enabled: false, available: true, deviceId: null, label: null },
  { kind: 'screen', enabled: false, available: true, deviceId: null, label: null },
  { kind: 'screenAudio', enabled: false, available: true, deviceId: null, label: null }
]

export const createInitialState = (): LocalMediaState => ({
  tracks: createInitialTracks(),
  preview: {
    micEnabled: true,
    cameraEnabled: false,
    previewAvailable: false,
    stream: null,
    status: 'idle',
    error: null
  },
  noiseSuppressionEnabled: true
})

export class LocalMediaStateStore {
  readonly mediaState = new MutableStateFlow<LocalMediaState>(createInitialState())
}
