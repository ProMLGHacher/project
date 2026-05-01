import { MutableStateFlow, err, ok, type PromiseResult } from '@kvt/core'
import {
  ConferenceClient,
  type ConferenceDiagnostics,
  type RoomSnapshot,
  type SlotUpdatedPayload
} from '@kvatum/rms-sdk'
import type { AudioProcessingRepository } from '@capabilities/audio-processing/domain/repository/AudioProcessingRepository'
import { exactDeviceId } from '@capabilities/media/domain/model'
import type {
  ConnectRtcParams,
  RtcDiagnostics,
  RtcError,
  RtcMediaSlotKind,
  RtcMediaStreams,
  RtcSession
} from '@capabilities/rtc/domain/model'
import type { RtcRepository } from '@capabilities/rtc/domain/repository/RtcRepository'

const initialSession: RtcSession = {
  roomId: '',
  participantId: '',
  status: 'idle',
  snapshot: null,
  localMediaStreams: {},
  remoteMediaStreams: {}
}

export class BrowserRtcRepository implements RtcRepository {
  private readonly sessionState = new MutableStateFlow<RtcSession>(initialSession)
  private readonly diagnosticsState = new MutableStateFlow<RtcDiagnostics | null>(null)
  private client: ConferenceClient | null = null

  constructor(private readonly audioProcessingRepository: AudioProcessingRepository) {}

  readonly session = this.sessionState.asStateFlow()
  readonly diagnostics = this.diagnosticsState.asStateFlow()

  async connect(params: ConnectRtcParams): PromiseResult<void, RtcError> {
    this.disconnect()
    this.sessionState.set({
      roomId: params.roomId,
      participantId: params.participantId,
      status: 'connecting',
      snapshot: null,
      localMediaStreams: {},
      remoteMediaStreams: {}
    })

    if (params.audioProcessing) {
      this.audioProcessingRepository.configure(params.audioProcessing)
    }

    this.client = new ConferenceClient({
      onSnapshot: (snapshot) => this.applySnapshot(params.participantId, snapshot),
      onSlotUpdated: (slot) => this.applySlotUpdate(slot),
      onRemoteTrack: (participantId, kind, stream) =>
        this.applyRemoteStream(participantId, kind, stream),
      onRemoteStreamsReset: () => this.clearRemoteStreams(),
      onLocalSlotStream: (kind, stream) => this.applyLocalSlotStream(kind, stream),
      onStateChange: (state) => this.updateStatus(state),
      onDiagnostics: (diagnostics) => this.updateDiagnostics(diagnostics),
      onError: (message) => {
        this.diagnosticsState.set({
          ...(this.diagnosticsState.value ?? emptyDiagnostics()),
          lastError: message
        })
      }
    })

    try {
      await this.client.start({
        wsUrl: params.wsUrl,
        rmsUrl: params.rmsUrl,
        joinToken: params.joinToken,
        iceServers: params.iceServers.map((server) => ({
          urls: [...server.urls],
          username: server.username,
          credential: server.credential
        })),
        micEnabled: params.micEnabled,
        cameraEnabled: params.cameraEnabled,
        microphoneDeviceId: params.microphoneDeviceId,
        createMicrophoneStream: (streamParams) => this.createProcessedMicrophoneStream(streamParams)
      })
      return ok()
    } catch (error) {
      return err({ type: 'unknown-error', message: readableError(error) })
    }
  }

  disconnect(): void {
    this.client?.close()
    this.audioProcessingRepository.release('rtc-microphone')
    this.client = null
    this.sessionState.update((session) => ({
      ...session,
      status: 'closed',
      localMediaStreams: {},
      remoteMediaStreams: {}
    }))
  }

  async setMicrophoneEnabled(enabled: boolean): PromiseResult<void, RtcError> {
    try {
      await this.client?.setMicEnabled(enabled)
      if (!enabled) {
        this.audioProcessingRepository.release('rtc-microphone')
      }
      return ok()
    } catch (error) {
      return err({ type: 'media-publish-failed', message: readableError(error) })
    }
  }

  async setCameraEnabled(enabled: boolean): PromiseResult<void, RtcError> {
    try {
      await this.client?.setCameraEnabled(enabled)
      return ok()
    } catch (error) {
      return err({ type: 'media-publish-failed', message: readableError(error) })
    }
  }

  async setScreenShareEnabled(enabled: boolean): PromiseResult<void, RtcError> {
    try {
      await this.client?.setScreenEnabled(enabled)
      return ok()
    } catch (error) {
      return err({ type: 'media-publish-failed', message: readableError(error) })
    }
  }

  async restartIce(): PromiseResult<void, RtcError> {
    return ok()
  }

  async forceRelayTransport(): PromiseResult<void, RtcError> {
    return ok()
  }

  private applySnapshot(participantId: string, snapshot: RoomSnapshot) {
    this.sessionState.set({
      roomId: snapshot.roomId,
      participantId,
      status: 'connected',
      localMediaStreams: this.sessionState.value.localMediaStreams,
      remoteMediaStreams: this.filterRemoteMediaStreams(snapshot),
      snapshot: {
        roomId: snapshot.roomId,
        hostParticipantId: snapshot.hostParticipantId,
        participants: snapshot.participants.map((participant) => ({
          ...participant,
          slots: participant.slots.map((slot) => ({
            ...slot,
            participantId: participant.id
          }))
        }))
      }
    })
  }

  private applySlotUpdate(slot: SlotUpdatedPayload) {
    const snapshot = this.sessionState.value.snapshot
    if (!snapshot) {
      return
    }

    this.sessionState.update((session) => {
      // trackBound:false означает, что слот реально отвязан в RTC; удаляем stream, чтобы UI не показывал стопкадр.
      const nextRemoteMediaStreams =
        slot.trackBound || slot.participantId === session.participantId
          ? session.remoteMediaStreams
          : withoutRemoteSlotStream(session.remoteMediaStreams, slot.participantId, slot.kind)

      return {
        ...session,
        remoteMediaStreams: nextRemoteMediaStreams,
        snapshot: {
          ...snapshot,
          participants: snapshot.participants.map((participant) =>
            participant.id === slot.participantId
              ? {
                  ...participant,
                  slots: participant.slots.map((currentSlot) =>
                    currentSlot.kind === slot.kind
                      ? {
                          ...currentSlot,
                          enabled: slot.enabled,
                          publishing: slot.publishing,
                          trackBound: slot.trackBound,
                          revision: currentSlot.revision + 1
                        }
                      : currentSlot
                  )
                }
              : participant
          )
        }
      }
    })
  }

  private updateStatus(state: string) {
    this.sessionState.update((session) => ({
      ...session,
      status: mapConnectionStatus(state)
    }))
  }

  private applyLocalSlotStream(kind: RtcMediaSlotKind, stream: MediaStream | null) {
    if (!stream) {
      this.sessionState.update((session) => ({
        ...session,
        localMediaStreams: withoutSlotStream(session.localMediaStreams, kind)
      }))
      return
    }

    this.sessionState.update((session) => ({
      ...session,
      localMediaStreams: {
        ...session.localMediaStreams,
        [kind]: stream
      }
    }))
  }

  private applyRemoteStream(
    participantId: string,
    kind: RtcMediaSlotKind,
    stream: MediaStream | null
  ) {
    if (!stream) {
      this.sessionState.update((session) => ({
        ...session,
        remoteMediaStreams: withoutRemoteSlotStream(session.remoteMediaStreams, participantId, kind)
      }))
      return
    }

    this.sessionState.update((session) => ({
      ...session,
      remoteMediaStreams: {
        ...session.remoteMediaStreams,
        [participantId]: {
          ...(session.remoteMediaStreams[participantId] ?? {}),
          [kind]: stream
        }
      }
    }))
  }

  private clearRemoteStreams() {
    this.sessionState.update((session) => ({
      ...session,
      remoteMediaStreams: {}
    }))
  }

  private filterRemoteMediaStreams(
    snapshot: RoomSnapshot
  ): Readonly<Record<string, RtcMediaStreams>> {
    const activeParticipantIds = new Set(snapshot.participants.map((participant) => participant.id))
    return Object.fromEntries(
      Object.entries(this.sessionState.value.remoteMediaStreams).filter(([participantId]) =>
        activeParticipantIds.has(participantId)
      )
    )
  }

  private updateDiagnostics(diagnostics: ConferenceDiagnostics) {
    this.diagnosticsState.set({
      signalingState: diagnostics.signalingState,
      publisherConnectionState: diagnostics.publisher.connectionState,
      publisherIceState: diagnostics.publisher.iceConnectionState,
      subscriberConnectionState: diagnostics.subscriber.connectionState,
      subscriberIceState: diagnostics.subscriber.iceConnectionState,
      recentSignalsSent: diagnostics.recentSignalsSent,
      recentSignalsReceived: diagnostics.recentSignalsReceived,
      lastError: diagnostics.lastError
    })
  }

  private async createProcessedMicrophoneStream({
    microphoneDeviceId
  }: {
    microphoneDeviceId?: string | null
  }): Promise<MediaStream> {
    const rawStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        deviceId: exactDeviceId(microphoneDeviceId),
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      },
      video: false
    })
    const processed = await this.audioProcessingRepository.createProcessedMicrophoneStream({
      owner: 'rtc-microphone',
      rawStream
    })
    return processed.ok ? processed.value : rawStream
  }
}

function mapConnectionStatus(state: string): RtcSession['status'] {
  if (state === 'connected' || state === 'completed') return 'connected'
  if (state === 'checking' || state === 'connecting' || state === 'new') return 'connecting'
  if (state === 'disconnected') return 'reconnecting'
  if (state === 'failed') return 'failed'
  if (state === 'closed') return 'closed'
  return 'idle'
}

function emptyDiagnostics(): RtcDiagnostics {
  return {
    signalingState: 'idle',
    publisherConnectionState: 'not-created',
    publisherIceState: 'not-created',
    subscriberConnectionState: 'not-created',
    subscriberIceState: 'not-created',
    recentSignalsSent: [],
    recentSignalsReceived: [],
    lastError: null
  }
}

function withoutRemoteSlotStream(
  streams: Readonly<Record<string, RtcMediaStreams>>,
  participantId: string,
  kind: RtcMediaSlotKind
): Readonly<Record<string, RtcMediaStreams>> {
  const participantStreams = streams[participantId]
  if (!participantStreams?.[kind]) {
    return streams
  }

  const nextParticipantStreams = { ...participantStreams }
  delete nextParticipantStreams[kind]

  return {
    ...streams,
    [participantId]: nextParticipantStreams
  }
}

function withoutSlotStream(streams: RtcMediaStreams, kind: RtcMediaSlotKind): RtcMediaStreams {
  if (!streams[kind]) {
    return streams
  }

  const nextStreams = { ...streams }
  delete nextStreams[kind]
  return nextStreams
}

function readableError(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
