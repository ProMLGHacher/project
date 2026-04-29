import { err, ok, type MutableStateFlow, type PromiseResult } from '@kvt/core'
import type {
  LocalMediaState,
  LocalMediaTrackKind,
  MediaError,
  StartLocalPreviewParams
} from '@capabilities/media/domain/model'
import type { LocalPreviewRepository } from '@capabilities/media/domain/repository/LocalPreviewRepository'
import { LocalMediaStateStore } from './LocalMediaStateStore'

type LocalMediaTrack = LocalMediaState['tracks'][number]
type PreviewState = LocalMediaState['preview']

export class BrowserLocalPreviewRepository implements LocalPreviewRepository {
  private readonly mediaState: MutableStateFlow<LocalMediaState>
  private previewStream: MediaStream | null = null
  private previewRequestId = 0

  constructor(stateStore: LocalMediaStateStore) {
    this.mediaState = stateStore.mediaState
  }

  get state() {
    return this.mediaState.asStateFlow()
  }

  async startPreview(params: StartLocalPreviewParams): PromiseResult<void, MediaError> {
    const unavailableError = getMediaApiUnavailableError('getUserMedia')

    if (unavailableError) {
      return err(unavailableError)
    }

    const requestId = this.startNewPreviewRequest()

    this.stopCurrentPreviewStream()
    this.markPreviewAsRequesting()

    try {
      const stream = await navigator.mediaDevices.getUserMedia(
        this.createPreviewConstraints(params)
      )

      if (!this.isLatestPreviewRequest(requestId)) {
        stopStream(stream)
        return ok()
      }

      this.previewStream = stream
      this.applyPreviewEnabledState(stream, params)
      this.markPreviewAsReady(params, stream)

      return ok()
    } catch (error) {
      if (!this.isLatestPreviewRequest(requestId)) {
        return ok()
      }

      const mediaError = toMediaError(error)
      this.markPreviewAsFailed(mediaError)

      return err(mediaError)
    }
  }

  stopPreview(): void {
    this.cancelPendingPreviewRequests()
    this.stopCurrentPreviewStream()

    this.patchPreview({
      previewAvailable: false,
      stream: null,
      status: 'idle',
      error: null
    })
  }

  async setMicrophoneEnabled(enabled: boolean): PromiseResult<void, MediaError> {
    const microphoneTracks = this.previewStream?.getAudioTracks() ?? []

    if (microphoneTracks.length === 0) {
      return this.restartPreview({
        micEnabled: enabled
      })
    }

    setTracksEnabled(microphoneTracks, enabled)

    this.mediaState.update((state) => ({
      ...state,
      tracks: updateTrack(state.tracks, 'audio', (track) => ({
        ...track,
        enabled,
        available: true
      })),
      preview: {
        ...state.preview,
        micEnabled: enabled
      }
    }))

    return ok()
  }

  setCameraEnabled(enabled: boolean): PromiseResult<void, MediaError> {
    return this.restartPreview({
      cameraEnabled: enabled
    })
  }

  setNoiseSuppressionEnabled(enabled: boolean): void {
    this.mediaState.update((state) => ({
      ...state,
      noiseSuppressionEnabled: enabled
    }))

    this.previewStream?.getAudioTracks().forEach((track) => {
      void track
        .applyConstraints({
          noiseSuppression: enabled
        })
        .catch(() => undefined)
    })
  }

  private restartPreview(
    overrides: Partial<Pick<StartLocalPreviewParams, 'micEnabled' | 'cameraEnabled'>>
  ): PromiseResult<void, MediaError> {
    const currentPreview = this.mediaState.value.preview

    return this.startPreview({
      micEnabled: overrides.micEnabled ?? currentPreview.micEnabled,
      cameraEnabled: overrides.cameraEnabled ?? currentPreview.cameraEnabled,
      microphoneDeviceId: this.deviceIdFor('audio'),
      cameraDeviceId: this.deviceIdFor('camera')
    })
  }

  private startNewPreviewRequest(): number {
    this.previewRequestId += 1
    return this.previewRequestId
  }

  private cancelPendingPreviewRequests(): void {
    this.startNewPreviewRequest()
  }

  private isLatestPreviewRequest(requestId: number): boolean {
    return requestId === this.previewRequestId
  }

  private stopCurrentPreviewStream(): void {
    if (!this.previewStream) {
      return
    }

    stopStream(this.previewStream)
    this.previewStream = null
  }

  private markPreviewAsRequesting(): void {
    this.patchPreview({
      status: 'requesting',
      error: null,
      stream: null,
      previewAvailable: false
    })
  }

  private markPreviewAsReady(params: StartLocalPreviewParams, stream: MediaStream): void {
    const microphoneTrack = firstOrNull(stream.getAudioTracks())
    const cameraTrack = params.cameraEnabled ? firstOrNull(stream.getVideoTracks()) : null
    const cameraPreviewAvailable = Boolean(cameraTrack)

    this.mediaState.update((state) => ({
      ...state,
      tracks: state.tracks.map((track) => {
        if (track.kind === 'audio') {
          return {
            ...track,
            enabled: params.micEnabled,
            available: Boolean(microphoneTrack),
            deviceId: params.microphoneDeviceId ?? getTrackDeviceId(microphoneTrack),
            label: getTrackLabel(microphoneTrack)
          }
        }

        if (track.kind === 'camera') {
          return {
            ...track,
            enabled: params.cameraEnabled,
            available: params.cameraEnabled ? cameraPreviewAvailable : track.available,
            deviceId: params.cameraDeviceId ?? getTrackDeviceId(cameraTrack) ?? track.deviceId,
            label: params.cameraEnabled ? getTrackLabel(cameraTrack) : track.label
          }
        }

        return track
      }),
      preview: {
        micEnabled: params.micEnabled,
        cameraEnabled: params.cameraEnabled,
        previewAvailable: params.cameraEnabled && cameraPreviewAvailable,
        stream,
        status: 'ready',
        error: null
      }
    }))
  }

  private markPreviewAsFailed(mediaError: MediaError): void {
    this.stopCurrentPreviewStream()

    this.patchPreview({
      status: mediaError.type === 'permission-denied' ? 'blocked' : 'failed',
      error: mediaError,
      stream: null,
      previewAvailable: false
    })
  }

  private patchPreview(patch: Partial<PreviewState>): void {
    this.mediaState.update((state) => ({
      ...state,
      preview: {
        ...state.preview,
        ...patch
      }
    }))
  }

  private createPreviewConstraints(params: StartLocalPreviewParams): MediaStreamConstraints {
    return {
      audio: {
        deviceId: exactDeviceId(params.microphoneDeviceId),
        noiseSuppression: this.mediaState.value.noiseSuppressionEnabled,
        echoCancellation: true,
        autoGainControl: true
      },
      video: params.cameraEnabled
        ? {
            deviceId: exactDeviceId(params.cameraDeviceId)
          }
        : false
    }
  }

  private applyPreviewEnabledState(stream: MediaStream, params: StartLocalPreviewParams): void {
    setTracksEnabled(stream.getAudioTracks(), params.micEnabled)
    setTracksEnabled(stream.getVideoTracks(), params.cameraEnabled)
  }

  private deviceIdFor(kind: LocalMediaTrackKind): string | null {
    return this.mediaState.value.tracks.find((track) => track.kind === kind)?.deviceId ?? null
  }
}

function updateTrack(
  tracks: readonly LocalMediaTrack[],
  kind: LocalMediaTrackKind,
  update: (track: LocalMediaTrack) => LocalMediaTrack
): LocalMediaTrack[] {
  return tracks.map((track) => (track.kind === kind ? update(track) : track))
}

function stopStream(stream: MediaStream): void {
  stream.getTracks().forEach((track) => {
    track.stop()
  })
}

function setTracksEnabled(tracks: readonly MediaStreamTrack[], enabled: boolean): void {
  tracks.forEach((track) => {
    track.enabled = enabled
  })
}

function firstOrNull<T>(items: readonly T[]): T | null {
  return items[0] ?? null
}

function exactDeviceId(deviceId: string | null | undefined): MediaTrackConstraints['deviceId'] {
  return deviceId ? { exact: deviceId } : undefined
}

function getTrackDeviceId(track: MediaStreamTrack | null): string | null {
  return track?.getSettings().deviceId ?? null
}

function getTrackLabel(track: MediaStreamTrack | null): string | null {
  return track?.label || null
}

function getMediaApiUnavailableError(api: 'getUserMedia' | 'getDisplayMedia'): MediaError | null {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return { type: 'api-unavailable' }
  }

  if (!window.isSecureContext) {
    return { type: 'insecure-context' }
  }

  if (!navigator.mediaDevices) {
    return { type: 'api-unavailable' }
  }

  if (api === 'getUserMedia' && !navigator.mediaDevices.getUserMedia) {
    return { type: 'api-unavailable' }
  }

  if (api === 'getDisplayMedia' && !navigator.mediaDevices.getDisplayMedia) {
    return { type: 'api-unavailable' }
  }

  return null
}

function toMediaError(error: unknown): MediaError {
  if (!(error instanceof DOMException)) {
    return {
      type: 'unknown-error',
      message: error instanceof Error ? error.message : undefined
    }
  }

  switch (error.name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return { type: 'permission-denied' }

    case 'NotFoundError':
    case 'OverconstrainedError':
      return { type: 'device-not-found' }

    case 'NotReadableError':
    case 'AbortError':
      return { type: 'device-busy' }

    default:
      return {
        type: 'unknown-error',
        message: error.message
      }
  }
}
