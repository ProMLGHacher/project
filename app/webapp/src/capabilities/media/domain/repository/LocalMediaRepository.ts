import type { PromiseResult, StateFlow } from '@kvt/core'
import type { LocalMediaState, MediaError, StartLocalPreviewParams } from '../model'

export interface LocalMediaRepository {
  readonly state: StateFlow<LocalMediaState>
  startPreview(params: StartLocalPreviewParams): PromiseResult<void, MediaError>
  stopPreview(): void
  setMicrophoneEnabled(enabled: boolean): PromiseResult<void, MediaError>
  setCameraEnabled(enabled: boolean): PromiseResult<void, MediaError>
  setScreenShareEnabled(enabled: boolean): PromiseResult<void, MediaError>
  setNoiseSuppressionEnabled(enabled: boolean): void
}
