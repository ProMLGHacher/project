import { err, ok, type MutableStateFlow, type PromiseResult } from '@kvt/core'
import type {
  LocalMediaState,
  LocalMediaTrackKind,
  MediaError
} from '@capabilities/media/domain/model'
import type { ScreenShareRepository } from '@capabilities/media/domain/repository/ScreenShareRepository'
import { LocalMediaStateStore } from './LocalMediaStateStore'

type LocalMediaTrack = LocalMediaState['tracks'][number]

export class BrowserScreenShareRepository implements ScreenShareRepository {
  private readonly mediaState: MutableStateFlow<LocalMediaState>
  private screenShareStream: MediaStream | null = null
  private screenShareRequestId = 0

  constructor(stateStore: LocalMediaStateStore) {
    this.mediaState = stateStore.mediaState
  }

  async setScreenShareEnabled(enabled: boolean): PromiseResult<void, MediaError> {
    if (!enabled) {
      this.cancelPendingScreenShareRequests()
      this.stopCurrentScreenShareStream()
      this.markScreenShareAsStopped()

      return ok()
    }

    const unavailableError = getMediaApiUnavailableError('getDisplayMedia')

    if (unavailableError) {
      return err(unavailableError)
    }

    const requestId = this.startNewScreenShareRequest()
    this.stopCurrentScreenShareStream()

    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false
      })

      if (!this.isLatestScreenShareRequest(requestId)) {
        stopStream(stream)
        return ok()
      }

      this.screenShareStream = stream

      this.watchForBrowserScreenShareStop(stream)
      this.markScreenShareAsReady(stream)

      return ok()
    } catch (error) {
      if (!this.isLatestScreenShareRequest(requestId)) {
        return ok()
      }

      const mediaError = toMediaError(error)
      this.markScreenShareAsFailed(mediaError)

      return err(mediaError)
    }
  }

  private startNewScreenShareRequest(): number {
    this.screenShareRequestId += 1
    return this.screenShareRequestId
  }

  private cancelPendingScreenShareRequests(): void {
    this.startNewScreenShareRequest()
  }

  private isLatestScreenShareRequest(requestId: number): boolean {
    return requestId === this.screenShareRequestId
  }

  private stopCurrentScreenShareStream(): void {
    if (!this.screenShareStream) {
      return
    }

    stopStream(this.screenShareStream)
    this.screenShareStream = null
  }

  private markScreenShareAsReady(stream: MediaStream): void {
    const screenTrack = firstOrNull(stream.getVideoTracks())

    this.mediaState.update((state) => ({
      ...state,
      tracks: updateTrack(state.tracks, 'screen', (track) => ({
        ...track,
        enabled: Boolean(screenTrack),
        available: Boolean(screenTrack),
        deviceId: getTrackDeviceId(screenTrack),
        label: getTrackLabel(screenTrack)
      }))
    }))
  }

  private markScreenShareAsStopped(): void {
    this.mediaState.update((state) => ({
      ...state,
      tracks: updateTrack(state.tracks, 'screen', (track) => ({
        ...track,
        enabled: false
      }))
    }))
  }

  private markScreenShareAsFailed(mediaError: MediaError): void {
    this.stopCurrentScreenShareStream()

    this.mediaState.update((state) => ({
      ...state,
      tracks: updateTrack(state.tracks, 'screen', (track) => ({
        ...track,
        enabled: false,
        available: mediaError.type === 'device-not-found' ? false : track.available
      }))
    }))
  }

  private watchForBrowserScreenShareStop(stream: MediaStream): void {
    const screenTrack = firstOrNull(stream.getVideoTracks())

    screenTrack?.addEventListener(
      'ended',
      () => {
        if (this.screenShareStream !== stream) {
          return
        }

        this.screenShareStream = null
        this.markScreenShareAsStopped()
      },
      { once: true }
    )
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

function firstOrNull<T>(items: readonly T[]): T | null {
  return items[0] ?? null
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
