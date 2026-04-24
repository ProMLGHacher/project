import { MutableStateFlow, err, ok, type PromiseResult } from '@kvt/core'
import type {
  LocalMediaState,
  LocalMediaTrackKind,
  MediaError,
  StartLocalPreviewParams
} from '@capabilities/media/domain/model'
import type { LocalMediaRepository } from '@capabilities/media/domain/repository/LocalMediaRepository'

type LocalMediaTrack = LocalMediaState['tracks'][number]

const createInitialState = (): LocalMediaState => ({
  tracks: [
    { kind: 'audio', enabled: true, available: true, deviceId: null, label: null },
    { kind: 'camera', enabled: false, available: true, deviceId: null, label: null },
    { kind: 'screen', enabled: false, available: true, deviceId: null, label: null }
  ],
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

export class BrowserLocalMediaRepository implements LocalMediaRepository {
  private readonly mediaState = new MutableStateFlow<LocalMediaState>(createInitialState())

  private previewStream: MediaStream | null = null
  private previewRequestId = 0

  readonly state = this.mediaState.asStateFlow()

  async startPreview(params: StartLocalPreviewParams): PromiseResult<void, MediaError> {
    const unavailableError = this.getApiUnavailableError()

    if (unavailableError) {
      return err(unavailableError)
    }

    const requestId = this.nextPreviewRequest()

    this.stopPreviewStream()
    this.setPreviewRequesting()

    try {
      const stream = await navigator.mediaDevices.getUserMedia(this.createMediaConstraints(params))

      if (!this.isCurrentPreviewRequest(requestId)) {
        stopStream(stream)
        return ok()
      }

      this.previewStream = stream
      this.applyTrackEnabledState(stream, params)
      this.setPreviewReady(params, stream)

      return ok()
    } catch (error) {
      if (!this.isCurrentPreviewRequest(requestId)) {
        return ok()
      }

      const mediaError = toMediaError(error)
      this.setPreviewFailed(mediaError)

      return err(mediaError)
    }
  }

  stopPreview(): void {
    this.nextPreviewRequest()
    this.stopPreviewStream()

    this.mediaState.update((state) => ({
      ...state,
      preview: {
        ...state.preview,
        previewAvailable: false,
        stream: null,
        status: 'idle',
        error: null
      }
    }))
  }

  async setMicrophoneEnabled(enabled: boolean): PromiseResult<void, MediaError> {
    const audioTracks = this.previewStream?.getAudioTracks() ?? []

    if (audioTracks.length === 0) {
      const current = this.mediaState.value.preview

      return this.startPreview({
        micEnabled: enabled,
        cameraEnabled: current.cameraEnabled,
        microphoneDeviceId: this.deviceIdFor('audio'),
        cameraDeviceId: this.deviceIdFor('camera')
      })
    }

    audioTracks.forEach((track) => {
      track.enabled = enabled
    })

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

  async setCameraEnabled(enabled: boolean): PromiseResult<void, MediaError> {
    const current = this.mediaState.value.preview

    return this.startPreview({
      micEnabled: current.micEnabled,
      cameraEnabled: enabled,
      microphoneDeviceId: this.deviceIdFor('audio'),
      cameraDeviceId: this.deviceIdFor('camera')
    })
  }

  async setScreenShareEnabled(enabled: boolean): PromiseResult<void, MediaError> {
    this.mediaState.update((state) => ({
      ...state,
      tracks: updateTrack(state.tracks, 'screen', (track) => ({
        ...track,
        enabled
      }))
    }))

    return ok()
  }

  setNoiseSuppressionEnabled(enabled: boolean): void {
    this.mediaState.update((state) => ({
      ...state,
      noiseSuppressionEnabled: enabled
    }))
  }

  private getApiUnavailableError(): MediaError | null {
    if (!navigator.mediaDevices?.getUserMedia) {
      return { type: 'api-unavailable' }
    }

    if (!window.isSecureContext) {
      return { type: 'insecure-context' }
    }

    return null
  }

  private nextPreviewRequest(): number {
    this.previewRequestId += 1
    return this.previewRequestId
  }

  private isCurrentPreviewRequest(requestId: number): boolean {
    return requestId === this.previewRequestId
  }

  private stopPreviewStream(): void {
    this.previewStream?.getTracks().forEach((track) => {
      track.stop()
    })

    this.previewStream = null
  }

  private setPreviewRequesting(): void {
    this.mediaState.update((state) => ({
      ...state,
      preview: {
        ...state.preview,
        status: 'requesting',
        error: null,
        stream: null,
        previewAvailable: false
      }
    }))
  }

  private setPreviewReady(params: StartLocalPreviewParams, stream: MediaStream): void {
    const hasAudioTrack = stream.getAudioTracks().length > 0
    const hasVideoTrack = stream.getVideoTracks().length > 0

    this.mediaState.update((state) => ({
      ...state,
      tracks: state.tracks.map((track) => {
        if (track.kind === 'audio') {
          return {
            ...track,
            enabled: params.micEnabled,
            available: hasAudioTrack,
            deviceId: params.microphoneDeviceId ?? null
          }
        }

        if (track.kind === 'camera') {
          return {
            ...track,
            enabled: params.cameraEnabled,
            available: params.cameraEnabled ? hasVideoTrack : track.available,
            deviceId: params.cameraDeviceId ?? null
          }
        }

        return track
      }),
      preview: {
        micEnabled: params.micEnabled,
        cameraEnabled: params.cameraEnabled,
        previewAvailable: params.cameraEnabled && hasVideoTrack,
        stream,
        status: 'ready',
        error: null
      }
    }))
  }

  private setPreviewFailed(mediaError: MediaError): void {
    this.stopPreviewStream()

    this.mediaState.update((state) => ({
      ...state,
      preview: {
        ...state.preview,
        status: mediaError.type === 'permission-denied' ? 'blocked' : 'failed',
        error: mediaError,
        stream: null,
        previewAvailable: false
      }
    }))
  }

  private createMediaConstraints(params: StartLocalPreviewParams): MediaStreamConstraints {
    return {
      audio: {
        deviceId: params.microphoneDeviceId ? { exact: params.microphoneDeviceId } : undefined,
        noiseSuppression: this.mediaState.value.noiseSuppressionEnabled,
        echoCancellation: true,
        autoGainControl: true
      },
      video: params.cameraEnabled
        ? {
            deviceId: params.cameraDeviceId ? { exact: params.cameraDeviceId } : undefined
          }
        : false
    }
  }

  private applyTrackEnabledState(stream: MediaStream, params: StartLocalPreviewParams): void {
    stream.getAudioTracks().forEach((track) => {
      track.enabled = params.micEnabled
    })

    stream.getVideoTracks().forEach((track) => {
      track.enabled = params.cameraEnabled
    })
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

function toMediaError(error: unknown): MediaError {
  if (error instanceof DOMException && error.name === 'NotAllowedError') {
    return { type: 'permission-denied' }
  }

  if (error instanceof DOMException && error.name === 'NotFoundError') {
    return { type: 'device-not-found' }
  }

  if (error instanceof DOMException && error.name === 'NotReadableError') {
    return { type: 'device-busy' }
  }

  return {
    type: 'unknown-error',
    message: error instanceof Error ? error.message : undefined
  }
}
