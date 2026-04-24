import type { MediaDeviceId } from './MediaDevice'

export type LocalMediaTrackKind = 'audio' | 'camera' | 'screen'

export type LocalMediaTrackState = {
  readonly kind: LocalMediaTrackKind
  readonly enabled: boolean
  readonly available: boolean
  readonly deviceId: MediaDeviceId | null
  readonly label: string | null
}

export type LocalPreviewState = {
  readonly micEnabled: boolean
  readonly cameraEnabled: boolean
  readonly previewAvailable: boolean
  readonly stream: MediaStream | null
  readonly status: 'idle' | 'requesting' | 'ready' | 'blocked' | 'failed'
  readonly error: MediaError | null
}

export type LocalMediaState = {
  readonly tracks: readonly LocalMediaTrackState[]
  readonly preview: LocalPreviewState
  readonly noiseSuppressionEnabled: boolean
}

export type StartLocalPreviewParams = {
  readonly micEnabled: boolean
  readonly cameraEnabled: boolean
  readonly microphoneDeviceId?: string | null
  readonly cameraDeviceId?: string | null
}

export type MediaError =
  | { readonly type: 'permission-denied' }
  | { readonly type: 'device-not-found' }
  | { readonly type: 'device-busy' }
  | { readonly type: 'insecure-context' }
  | { readonly type: 'api-unavailable' }
  | { readonly type: 'unknown-error'; readonly message?: string }
