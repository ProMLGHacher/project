import { SignalingClient, type SignalingState } from './signaling'
import type {
  CandidatePayload,
  ErrorPayload,
  ICEServerConfig,
  IceRestartPayload,
  RoomSnapshot,
  RoomSnapshotPayload,
  SessionDescriptionPayload,
  SignalEnvelope,
  SlotKind,
  SlotUpdatedPayload
} from './protocol'
import { logError, logInfo, logWarn } from './logger'
import {
  decidePeerRecoveryAction,
  PEER_CHECKING_TIMEOUT_MS,
  PEER_RECOVERY_COOLDOWN_MS,
  type IceTransportMode
} from './recovery'

type LocalPeerKind = 'publisher' | 'subscriber'

interface PeerHealthSnapshot {
  hasSelectedCandidatePair: boolean
  totalBytes: number
  hadSuccessfulTransport: boolean
  localCandidate: ReturnType<typeof describeCandidateStats>
  remoteCandidate: ReturnType<typeof describeCandidateStats>
  transport: ReturnType<typeof describeTransportStats>
  inbound: Array<Record<string, unknown>>
  outbound: Array<Record<string, unknown>>
}

interface PeerRuntimeRecoveryState {
  transportMode: IceTransportMode
  checkingTimer: number | null
  recoveryInFlight: boolean
  lastRecoveryAt: number | null
  hadSuccessfulTransport: boolean
}

export interface PeerDiagnostics {
  signalingState: string
  connectionState: string
  iceConnectionState: string
}

export interface ConferenceDiagnostics {
  signalingState: SignalingState
  publisher: PeerDiagnostics
  subscriber: PeerDiagnostics
  local: {
    micEnabled: boolean
    micTrack: boolean
    cameraTrack: boolean
    screenTrack: boolean
    screenAudioTrack: boolean
  }
  remoteSlotStreams: number
  recentSignalsSent: string[]
  recentSignalsReceived: string[]
  lastError: string | null
}

type ConferenceEvents = {
  onSnapshot: (snapshot: RoomSnapshot) => void
  onSlotUpdated: (payload: SlotUpdatedPayload) => void
  onRemoteTrack: (participantId: string, kind: SlotKind, stream: MediaStream | null) => void
  onRemoteStreamsReset?: () => void
  onLocalSlotStream?: (kind: SlotKind, stream: MediaStream | null) => void
  onStateChange: (state: string) => void
  onDiagnostics?: (diagnostics: ConferenceDiagnostics) => void
  onError?: (message: string) => void
}

type StartOptions = {
  wsUrl: string
  iceServers: ICEServerConfig[]
  micEnabled: boolean
  cameraEnabled: boolean
}

export class ConferenceClient {
  private signaling = new SignalingClient()
  private publisherPc: RTCPeerConnection | null = null
  private subscriberPc: RTCPeerConnection | null = null
  private audioTransceiver: RTCRtpTransceiver | null = null
  private cameraTransceiver: RTCRtpTransceiver | null = null
  private screenTransceiver: RTCRtpTransceiver | null = null
  private screenAudioTransceiver: RTCRtpTransceiver | null = null
  private localAudioTrack: MediaStreamTrack | null = null
  private localCameraTrack: MediaStreamTrack | null = null
  private localScreenTrack: MediaStreamTrack | null = null
  private localScreenAudioTrack: MediaStreamTrack | null = null
  private localSlotPreviewStreams = new Map<SlotKind, MediaStream>()
  private remoteSlotStreams = new Map<string, Map<SlotKind, MediaStream>>()
  private makingPublisherOffer = false
  private allowPublisherNegotiation = false
  private pendingPublisherCandidates: RTCIceCandidateInit[] = []
  private pendingSubscriberCandidates: RTCIceCandidateInit[] = []
  private startOptions: StartOptions | null = null
  private signalingState: SignalingState = 'idle'
  private recentSignalsSent: string[] = []
  private recentSignalsReceived: string[] = []
  private lastError: string | null = null
  private publisherRecovery: PeerRuntimeRecoveryState = createPeerRecoveryState()
  private subscriberRecovery: PeerRuntimeRecoveryState = createPeerRecoveryState()
  private closed = false

  constructor(private events: ConferenceEvents) {}

  async start(options: StartOptions) {
    try {
      this.closed = false
      this.startOptions = options
      logInfo('rtc', 'starting conference client', options)
      this.events.onStateChange('connecting')
      this.signaling.subscribeState((state) => {
        this.signalingState = state
        this.emitDiagnostics()
      })
      await this.signaling.connect(options.wsUrl)
      this.signaling.subscribe((message) => {
        void this.handleSignalMessage(message).catch((error) => {
          this.captureError(error)
        })
      })

      this.publisherPc = this.createPeerConnection(
        options.iceServers,
        'publisher',
        this.publisherRecovery.transportMode
      )
      this.subscriberPc = this.createPeerConnection(
        options.iceServers,
        'subscriber',
        this.subscriberRecovery.transportMode
      )
      this.reservePublisherSlots()
      this.emitDiagnostics()
      logInfo('rtc', 'publisher and subscriber peer connections created')

      await this.setMicEnabled(options.micEnabled)
      await this.setCameraEnabled(options.cameraEnabled)
      this.allowPublisherNegotiation = true
      await this.negotiatePublisher()
      logInfo('rtc', 'initial publisher negotiation completed')
    } catch (error) {
      this.captureError(error)
      throw error
    }
  }

  async setMicEnabled(enabled: boolean) {
    try {
      if (!this.publisherPc || !this.audioTransceiver) {
        return
      }

      if (!enabled && !this.localAudioTrack) {
        await this.audioTransceiver.sender.replaceTrack(null)
        this.publishLocalSlots()
        this.sendSlotUpdate('audio', false, false, false)
        this.emitDiagnostics()
        logInfo('rtc', 'microphone toggled', { enabled })
        return
      }

      if (!this.localAudioTrack) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
        this.localAudioTrack = stream.getAudioTracks()[0] ?? null
        await this.audioTransceiver.sender.replaceTrack(this.localAudioTrack)
      }

      if (this.localAudioTrack) {
        this.localAudioTrack.enabled = enabled
      }

      this.publishLocalSlots()
      this.sendSlotUpdate('audio', enabled, enabled, Boolean(this.localAudioTrack))
      this.emitDiagnostics()
      logInfo('rtc', 'microphone toggled', { enabled })
    } catch (error) {
      this.captureError(error)
      throw error
    }
  }

  async setCameraEnabled(enabled: boolean) {
    try {
      if (!this.cameraTransceiver) {
        return
      }

      if (enabled) {
        if (!this.localCameraTrack) {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: true })
          this.localCameraTrack = stream.getVideoTracks()[0] ?? null
        }
        await this.cameraTransceiver.sender.replaceTrack(this.localCameraTrack)
      } else {
        await this.cameraTransceiver.sender.replaceTrack(null)
        this.localCameraTrack?.stop()
        this.localCameraTrack = null
      }

      this.publishLocalSlots()
      this.sendSlotUpdate('camera', enabled, enabled, Boolean(this.localCameraTrack))
      this.emitDiagnostics()
      logInfo('rtc', 'camera toggled', { enabled })
    } catch (error) {
      this.captureError(error)
      throw error
    }
  }

  async setScreenEnabled(enabled: boolean) {
    try {
      if (!this.screenTransceiver || !this.screenAudioTransceiver) {
        return
      }

      if (enabled) {
        const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true })
        this.localScreenTrack = stream.getVideoTracks()[0] ?? null
        this.localScreenAudioTrack = stream.getAudioTracks()[0] ?? null
        if (this.localScreenTrack) {
          this.localScreenTrack.addEventListener('ended', () => {
            void this.setScreenEnabled(false)
          })
        }
        if (this.localScreenAudioTrack) {
          this.localScreenAudioTrack.addEventListener(
            'ended',
            () => {
              this.localScreenAudioTrack = null
              void this.screenAudioTransceiver?.sender.replaceTrack(null)
              this.publishLocalSlots()
              this.sendSlotUpdate('screenAudio', false, false, false)
              this.emitDiagnostics()
            },
            { once: true }
          )
        }
        await this.screenTransceiver.sender.replaceTrack(this.localScreenTrack)
        await this.screenAudioTransceiver.sender.replaceTrack(this.localScreenAudioTrack)
      } else {
        await this.screenTransceiver.sender.replaceTrack(null)
        await this.screenAudioTransceiver.sender.replaceTrack(null)
        this.localScreenTrack?.stop()
        this.localScreenAudioTrack?.stop()
        this.localScreenTrack = null
        this.localScreenAudioTrack = null
      }

      this.publishLocalSlots()
      this.sendSlotUpdate('screen', enabled, enabled, Boolean(this.localScreenTrack))
      this.sendSlotUpdate(
        'screenAudio',
        Boolean(enabled && this.localScreenAudioTrack),
        Boolean(enabled && this.localScreenAudioTrack),
        Boolean(this.localScreenAudioTrack)
      )
      this.emitDiagnostics()
      logInfo('rtc', 'screen share toggled', { enabled })
    } catch (error) {
      this.captureError(error)
      throw error
    }
  }

  close() {
    this.closed = true
    this.allowPublisherNegotiation = false
    this.clearRecoveryTimer('publisher')
    this.clearRecoveryTimer('subscriber')
    try {
      this.sendSignal({
        type: 'participant.left',
        payload: {}
      })
    } catch {
      // Best-effort leave signal. If the socket is already closing, fall back to disconnect cleanup.
    }
    this.signaling.close()
    this.publisherPc?.close()
    this.subscriberPc?.close()
    this.localAudioTrack?.stop()
    this.localCameraTrack?.stop()
    this.localScreenTrack?.stop()
    this.localScreenAudioTrack?.stop()
    this.localSlotPreviewStreams.clear()
    this.events.onLocalSlotStream?.('audio', null)
    this.events.onLocalSlotStream?.('camera', null)
    this.events.onLocalSlotStream?.('screen', null)
    this.events.onLocalSlotStream?.('screenAudio', null)
    this.emitDiagnostics()
    logInfo('rtc', 'conference client closed')
  }

  private createPeerConnection(
    iceServers: ICEServerConfig[],
    peer: LocalPeerKind,
    transportMode: IceTransportMode
  ) {
    const pc = new RTCPeerConnection({
      iceServers: iceServers.map((server) => ({
        urls: server.urls,
        username: server.username,
        credential: server.credential
      })),
      iceTransportPolicy: transportMode
    })

    pc.onicecandidate = (event) => {
      if (!event.candidate) {
        return
      }

      this.sendSignal<CandidatePayload>({
        type: 'trickle.candidate',
        payload: {
          peer,
          candidate: event.candidate.toJSON()
        }
      })
    }

    pc.onconnectionstatechange = () => {
      logInfo('rtc', 'peer connection state changed', { peer, connectionState: pc.connectionState })
      this.emitDiagnostics()
    }

    pc.oniceconnectionstatechange = () => {
      logInfo('rtc', 'peer ice state changed', { peer, iceConnectionState: pc.iceConnectionState })
      this.events.onStateChange(pc.iceConnectionState)
      this.emitDiagnostics()
      void this.logPeerStatsSnapshot(pc, peer, pc.iceConnectionState)
      this.handlePeerIceStateChange(peer, pc).catch((error) => {
        this.captureError(error)
      })
    }

    pc.onsignalingstatechange = () => {
      logInfo('rtc', 'peer signaling state changed', { peer, signalingState: pc.signalingState })
      this.emitDiagnostics()
    }

    if (peer === 'publisher') {
      pc.onnegotiationneeded = async () => {
        await this.negotiatePublisher().catch((error) => {
          this.captureError(error)
        })
      }
    }

    if (peer === 'subscriber') {
      pc.ontrack = (event) => {
        const [stream] = event.streams
        const participantId = stream?.id ?? 'unknown'
        const slotKind = parseSlotKind(event.track.id)
        if (!slotKind) {
          logWarn('rtc', 'remote track ignored without slot identity', {
            trackKind: event.track.kind,
            trackId: event.track.id,
            streamId: stream?.id ?? 'unknown',
            transceiverMid: event.transceiver?.mid ?? null
          })
          return
        }
        const participantStreams =
          this.remoteSlotStreams.get(participantId) ?? new Map<SlotKind, MediaStream>()
        const remoteStream = participantStreams.get(slotKind) ?? new MediaStream()
        syncPreviewTrack(remoteStream, event.track.kind as 'audio' | 'video', event.track)
        participantStreams.set(slotKind, remoteStream)
        this.remoteSlotStreams.set(participantId, participantStreams)
        this.events.onRemoteTrack(participantId, slotKind, remoteStream)
        this.emitDiagnostics()
        logInfo('rtc', 'remote track attached', {
          participantId,
          slotKind,
          trackKind: event.track.kind,
          trackId: event.track.id,
          streamId: stream?.id ?? 'unknown',
          muted: event.track.muted,
          readyState: event.track.readyState,
          transceiverMid: event.transceiver?.mid ?? null
        })

        const handleMute = () => {
          logInfo('rtc', 'remote track muted', {
            participantId,
            slotKind,
            trackKind: event.track.kind,
            trackId: event.track.id,
            readyState: event.track.readyState
          })
        }
        const handleUnmute = () => {
          logInfo('rtc', 'remote track unmuted', {
            participantId,
            slotKind,
            trackKind: event.track.kind,
            trackId: event.track.id,
            readyState: event.track.readyState
          })
          void this.logPeerStatsSnapshot(pc, peer, 'track-unmuted')
        }
        const handleEnded = () => {
          logWarn('rtc', 'remote track ended', {
            participantId,
            slotKind,
            trackKind: event.track.kind,
            trackId: event.track.id
          })
          remoteStream.removeTrack(event.track)
          participantStreams.delete(slotKind)
          this.events.onRemoteTrack(participantId, slotKind, null)
          this.emitDiagnostics()
        }

        event.track.addEventListener('mute', handleMute)
        event.track.addEventListener('unmute', handleUnmute)
        event.track.addEventListener('ended', handleEnded)

        window.setTimeout(() => {
          void this.logPeerStatsSnapshot(pc, peer, 'track-attached-1s')
        }, 1000)
        window.setTimeout(() => {
          void this.logPeerStatsSnapshot(pc, peer, 'track-attached-5s')
        }, 5000)
      }
    }

    return pc
  }

  private reservePublisherSlots() {
    if (!this.publisherPc) {
      return null
    }

    this.audioTransceiver = this.publisherPc.addTransceiver('audio', { direction: 'sendonly' })
    this.cameraTransceiver = this.publisherPc.addTransceiver('video', { direction: 'sendonly' })
    this.screenTransceiver = this.publisherPc.addTransceiver('video', { direction: 'sendonly' })
    this.screenAudioTransceiver = this.publisherPc.addTransceiver('audio', {
      direction: 'sendonly'
    })
    return {
      audio: this.audioTransceiver,
      camera: this.cameraTransceiver,
      screen: this.screenTransceiver,
      screenAudio: this.screenAudioTransceiver
    }
  }

  private async handleSignalMessage(message: SignalEnvelope) {
    this.recordSignal(this.recentSignalsReceived, message.type)
    this.emitDiagnostics()
    logInfo('rtc', 'handling signal message', { type: message.type, payload: message.payload })

    switch (message.type) {
      case 'room.snapshot': {
        const payload = message.payload as RoomSnapshotPayload
        this.events.onSnapshot(payload.snapshot)
        this.events.onStateChange('connected')
        return
      }
      case 'publisher.answer': {
        const payload = message.payload as SessionDescriptionPayload
        if (!this.publisherPc) {
          return
        }
        await this.publisherPc.setRemoteDescription(payload.description)
        await this.flushPendingCandidates(this.publisherPc, this.pendingPublisherCandidates)
        this.emitDiagnostics()
        return
      }
      case 'subscriber.offer': {
        const payload = message.payload as SessionDescriptionPayload
        if (!this.subscriberPc) {
          return
        }
        await this.subscriberPc.setRemoteDescription(payload.description)
        await this.flushPendingCandidates(this.subscriberPc, this.pendingSubscriberCandidates)
        const answer = await this.subscriberPc.createAnswer()
        await this.subscriberPc.setLocalDescription(answer)
        this.sendSignal<SessionDescriptionPayload>({
          type: 'subscriber.answer',
          payload: {
            peer: 'subscriber',
            description: answer
          }
        })
        this.emitDiagnostics()
        return
      }
      case 'trickle.candidate': {
        const payload = message.payload as CandidatePayload
        const pc = payload.peer === 'publisher' ? this.publisherPc : this.subscriberPc
        if (!pc) {
          return
        }
        if (!pc.remoteDescription) {
          if (payload.peer === 'publisher') {
            this.pendingPublisherCandidates.push(payload.candidate)
          } else {
            this.pendingSubscriberCandidates.push(payload.candidate)
          }
          return
        }
        await pc.addIceCandidate(payload.candidate)
        this.emitDiagnostics()
        return
      }
      case 'media.slot.updated': {
        this.events.onSlotUpdated(message.payload as SlotUpdatedPayload)
        return
      }
      case 'error': {
        const payload = message.payload as ErrorPayload
        this.captureError(new Error(payload.message))
        return
      }
      case 'ice.restart.requested': {
        const payload = message.payload as IceRestartPayload
        if (payload.peer === 'publisher') {
          await this.restartPublisherIce()
        }
        return
      }
      default:
        logWarn('rtc', 'ignoring unknown signal message type', { type: message.type })
        return
    }
  }

  private async restartPublisherIce() {
    await this.negotiatePublisher(true)
  }

  private async handlePeerIceStateChange(peer: LocalPeerKind, pc: RTCPeerConnection) {
    if (this.closed || this.getPeerConnection(peer) !== pc) {
      return
    }

    const recovery = this.getRecoveryState(peer)
    const state = pc.iceConnectionState

    if (state === 'connected' || state === 'completed') {
      recovery.hadSuccessfulTransport = true
      recovery.recoveryInFlight = false
      this.clearRecoveryTimer(peer)
      return
    }

    if (state === 'checking') {
      this.scheduleCheckingTimeout(peer, pc)
      return
    }

    this.clearRecoveryTimer(peer)

    if (state === 'disconnected' || state === 'failed') {
      await this.maybeRecoverPeer(peer, state, pc)
    }
  }

  private scheduleCheckingTimeout(peer: LocalPeerKind, pc: RTCPeerConnection) {
    const recovery = this.getRecoveryState(peer)
    if (recovery.checkingTimer !== null) {
      return
    }

    recovery.checkingTimer = window.setTimeout(() => {
      recovery.checkingTimer = null
      void this.evaluateCheckingTimeout(peer, pc).catch((error) => {
        this.captureError(error)
      })
    }, PEER_CHECKING_TIMEOUT_MS)
  }

  private clearRecoveryTimer(peer: LocalPeerKind) {
    const recovery = this.getRecoveryState(peer)
    if (recovery.checkingTimer !== null) {
      window.clearTimeout(recovery.checkingTimer)
      recovery.checkingTimer = null
    }
  }

  private async evaluateCheckingTimeout(peer: LocalPeerKind, pc: RTCPeerConnection) {
    if (
      this.closed ||
      this.getPeerConnection(peer) !== pc ||
      pc.iceConnectionState !== 'checking'
    ) {
      return
    }

    logWarn('rtc', 'peer checking timeout reached', {
      peer,
      transportMode: this.getRecoveryState(peer).transportMode,
      timeoutMs: PEER_CHECKING_TIMEOUT_MS
    })

    await this.maybeRecoverPeer(peer, 'checking', pc)
  }

  private async maybeRecoverPeer(
    peer: LocalPeerKind,
    reason: 'checking' | 'disconnected' | 'failed',
    pc: RTCPeerConnection
  ) {
    const recovery = this.getRecoveryState(peer)
    if (recovery.recoveryInFlight) {
      return
    }

    const now = Date.now()
    if (recovery.lastRecoveryAt && now - recovery.lastRecoveryAt < PEER_RECOVERY_COOLDOWN_MS) {
      logInfo('rtc', 'peer recovery skipped due to cooldown', {
        peer,
        reason,
        transportMode: recovery.transportMode,
        cooldownMs: PEER_RECOVERY_COOLDOWN_MS
      })
      return
    }

    const health = await this.readPeerHealth(pc, recovery.hadSuccessfulTransport)
    const action = decidePeerRecoveryAction({
      transportMode: recovery.transportMode,
      iceConnectionState: reason,
      health: {
        hasSelectedCandidatePair: health.hasSelectedCandidatePair,
        totalBytes: health.totalBytes,
        hadSuccessfulTransport: health.hadSuccessfulTransport
      }
    })

    logWarn('rtc', 'peer recovery decision', {
      peer,
      reason,
      transportMode: recovery.transportMode,
      action,
      hasSelectedCandidatePair: health.hasSelectedCandidatePair,
      totalBytes: health.totalBytes,
      localCandidate: health.localCandidate,
      remoteCandidate: health.remoteCandidate,
      transport: health.transport
    })

    if (action === 'none') {
      return
    }

    recovery.recoveryInFlight = true
    recovery.lastRecoveryAt = now
    try {
      if (action === 'fallback-relay') {
        await this.switchPeerToRelay(peer, reason)
        return
      }

      await this.requestPeerIceRestart(peer, reason)
    } finally {
      recovery.recoveryInFlight = false
    }
  }

  private async switchPeerToRelay(
    peer: LocalPeerKind,
    reason: 'checking' | 'disconnected' | 'failed'
  ) {
    if (!this.startOptions) {
      return
    }

    const recovery = this.getRecoveryState(peer)
    if (recovery.transportMode === 'relay') {
      await this.requestPeerIceRestart(peer, reason)
      return
    }

    recovery.transportMode = 'relay'
    recovery.hadSuccessfulTransport = false
    logWarn('rtc', 'switching peer to relay-only mode', { peer, reason })

    if (peer === 'publisher') {
      await this.rebuildPublisherPeer('relay')
      return
    }

    await this.rebuildSubscriberPeer('relay')
  }

  private async requestPeerIceRestart(
    peer: LocalPeerKind,
    reason: 'checking' | 'disconnected' | 'failed'
  ) {
    const recovery = this.getRecoveryState(peer)
    logWarn('rtc', 'requesting peer ice restart', {
      peer,
      reason,
      transportMode: recovery.transportMode
    })

    if (peer === 'publisher') {
      await this.restartPublisherIce()
      return
    }

    this.sendSignal<IceRestartPayload>({
      type: 'ice.restart.requested',
      payload: {
        peer: 'subscriber'
      }
    })
  }

  private async rebuildPublisherPeer(transportMode: IceTransportMode) {
    if (!this.startOptions) {
      return
    }

    this.clearRecoveryTimer('publisher')
    this.pendingPublisherCandidates = []
    this.publisherPc?.close()
    this.publisherPc = this.createPeerConnection(
      this.startOptions.iceServers,
      'publisher',
      transportMode
    )
    this.audioTransceiver = null
    this.cameraTransceiver = null
    this.screenTransceiver = null
    this.screenAudioTransceiver = null
    const slots = this.reservePublisherSlots()
    if (!slots) {
      return
    }

    if (this.localAudioTrack) {
      await slots.audio.sender.replaceTrack(this.localAudioTrack)
    }
    if (this.localCameraTrack) {
      await slots.camera.sender.replaceTrack(this.localCameraTrack)
    }
    if (this.localScreenTrack) {
      await slots.screen.sender.replaceTrack(this.localScreenTrack)
    }
    if (this.localScreenAudioTrack) {
      await slots.screenAudio.sender.replaceTrack(this.localScreenAudioTrack)
    }

    this.emitDiagnostics()
    logInfo('rtc', 'publisher peer rebuilt', { transportMode })
    await this.negotiatePublisher()
  }

  private async rebuildSubscriberPeer(transportMode: IceTransportMode) {
    if (!this.startOptions) {
      return
    }

    this.clearRecoveryTimer('subscriber')
    this.pendingSubscriberCandidates = []
    this.subscriberPc?.close()
    this.subscriberPc = this.createPeerConnection(
      this.startOptions.iceServers,
      'subscriber',
      transportMode
    )
    this.remoteSlotStreams.clear()
    this.events.onRemoteStreamsReset?.()
    this.emitDiagnostics()
    logInfo('rtc', 'subscriber peer rebuilt', { transportMode })
    this.sendSignal<IceRestartPayload>({
      type: 'ice.restart.requested',
      payload: {
        peer: 'subscriber'
      }
    })
  }

  private async logPeerStatsSnapshot(
    pc: RTCPeerConnection,
    peer: LocalPeerKind,
    reason: RTCIceConnectionState | 'track-unmuted' | 'track-attached-1s' | 'track-attached-5s'
  ) {
    if (
      ![
        'checking',
        'connected',
        'disconnected',
        'failed',
        'track-unmuted',
        'track-attached-1s',
        'track-attached-5s'
      ].includes(reason)
    ) {
      return
    }

    try {
      const health = await this.readPeerHealth(
        pc,
        this.getRecoveryState(peer).hadSuccessfulTransport
      )

      if (!health.hasSelectedCandidatePair) {
        logInfo('rtc', 'peer stats snapshot', {
          peer,
          reason,
          selectedPair: 'none',
          transport: health.transport,
          inbound: health.inbound,
          outbound: health.outbound
        })
        return
      }

      logInfo('rtc', 'peer stats snapshot', {
        peer,
        reason,
        hasSelectedCandidatePair: health.hasSelectedCandidatePair,
        totalBytes: health.totalBytes,
        localCandidate: health.localCandidate,
        remoteCandidate: health.remoteCandidate,
        transport: health.transport,
        inbound: health.inbound,
        outbound: health.outbound
      })
    } catch (error) {
      logWarn('rtc', 'peer stats snapshot failed', {
        peer,
        reason,
        error: error instanceof Error ? error.message : String(error)
      })
    }
  }

  private sendSlotUpdate(
    kind: SlotKind,
    enabled: boolean,
    publishing: boolean,
    trackBound: boolean
  ) {
    this.sendSignal<SlotUpdatedPayload>({
      type: 'media.slot.updated',
      payload: {
        participantId: 'local',
        kind,
        enabled,
        publishing,
        trackBound
      }
    })
  }

  private async negotiatePublisher(iceRestart = false) {
    if (!this.allowPublisherNegotiation || this.makingPublisherOffer || !this.publisherPc) {
      return
    }
    if (this.publisherPc.signalingState !== 'stable') {
      return
    }

    this.makingPublisherOffer = true
    try {
      const offer = await this.publisherPc.createOffer(
        iceRestart ? { iceRestart: true } : undefined
      )
      await this.publisherPc.setLocalDescription(offer)
      this.sendSignal<SessionDescriptionPayload>({
        type: 'publisher.offer',
        payload: {
          peer: 'publisher',
          description: offer,
          slotBindings: this.buildPublisherSlotBindings()
        }
      })
      this.emitDiagnostics()
      logInfo('rtc', 'publisher offer sent', { iceRestart })
    } finally {
      this.makingPublisherOffer = false
    }
  }

  private async flushPendingCandidates(pc: RTCPeerConnection, queue: RTCIceCandidateInit[]) {
    const pending = queue.splice(0, queue.length)
    for (const candidate of pending) {
      await pc.addIceCandidate(candidate)
    }
  }

  private sendSignal<T>(message: SignalEnvelope<T>) {
    this.recordSignal(this.recentSignalsSent, message.type)
    this.signaling.send(message)
    this.emitDiagnostics()
  }

  private recordSignal(queue: string[], type: string) {
    queue.push(type)
    if (queue.length > 8) {
      queue.shift()
    }
  }

  private captureError(error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    this.lastError = message
    this.events.onError?.(message)
    this.emitDiagnostics()
    logError('rtc', 'captured error', { message, error })
  }

  private emitDiagnostics() {
    this.events.onDiagnostics?.({
      signalingState: this.signalingState,
      publisher: describePeer(this.publisherPc),
      subscriber: describePeer(this.subscriberPc),
      local: {
        micEnabled: this.localAudioTrack?.enabled ?? false,
        micTrack: Boolean(this.localAudioTrack),
        cameraTrack: Boolean(this.localCameraTrack),
        screenTrack: Boolean(this.localScreenTrack),
        screenAudioTrack: Boolean(this.localScreenAudioTrack)
      },
      remoteSlotStreams: this.remoteSlotStreams.size,
      recentSignalsSent: [...this.recentSignalsSent],
      recentSignalsReceived: [...this.recentSignalsReceived],
      lastError: this.lastError
    })
  }

  private publishLocalSlots() {
    this.publishLocalSlotStream('audio', this.localAudioTrack)
    this.publishLocalSlotStream('camera', this.localCameraTrack)
    this.publishLocalSlotStream('screen', this.localScreenTrack)
    this.publishLocalSlotStream('screenAudio', this.localScreenAudioTrack)
    logInfo('rtc', 'local slot streams published', {
      slots: [...this.localSlotPreviewStreams.entries()].map(([kind, stream]) => ({
        kind,
        trackIds: stream.getTracks().map((track) => ({
          id: track.id,
          kind: track.kind,
          enabled: track.enabled,
          readyState: track.readyState
        }))
      }))
    })
  }

  private publishLocalSlotStream(kind: SlotKind, track: MediaStreamTrack | null) {
    if (!track) {
      this.localSlotPreviewStreams.delete(kind)
      this.events.onLocalSlotStream?.(kind, null)
      return
    }

    const stream = this.localSlotPreviewStreams.get(kind) ?? new MediaStream()
    syncPreviewTrack(stream, track.kind as 'audio' | 'video', track)
    this.localSlotPreviewStreams.set(kind, stream)
    this.events.onLocalSlotStream?.(kind, stream)
  }

  private buildPublisherSlotBindings(): Record<string, SlotKind> {
    const bindings: Record<string, SlotKind> = {}
    const slots: Array<readonly [SlotKind, RTCRtpTransceiver | null]> = [
      ['audio', this.audioTransceiver],
      ['camera', this.cameraTransceiver],
      ['screen', this.screenTransceiver],
      ['screenAudio', this.screenAudioTransceiver]
    ]

    for (const [kind, transceiver] of slots) {
      if (transceiver?.mid) {
        bindings[transceiver.mid] = kind
      }
    }

    return bindings
  }

  private getPeerConnection(peer: LocalPeerKind) {
    return peer === 'publisher' ? this.publisherPc : this.subscriberPc
  }

  private getRecoveryState(peer: LocalPeerKind) {
    return peer === 'publisher' ? this.publisherRecovery : this.subscriberRecovery
  }

  private async readPeerHealth(
    pc: RTCPeerConnection,
    hadSuccessfulTransport: boolean
  ): Promise<PeerHealthSnapshot> {
    const report = await pc.getStats()
    let selectedPair: RTCStats | null = null
    let transportStat: RTCStats | null = null
    const candidates = new Map<string, RTCStats>()
    const inbound: Array<Record<string, unknown>> = []
    const outbound: Array<Record<string, unknown>> = []

    report.forEach((stat) => {
      if (stat.type === 'transport') {
        transportStat = stat
      }
      if (
        stat.type === 'candidate-pair' &&
        (('selected' in stat && stat.selected) ||
          ('nominated' in stat && stat.nominated && 'state' in stat && stat.state === 'succeeded'))
      ) {
        selectedPair = stat
      }
      if (stat.type === 'local-candidate' || stat.type === 'remote-candidate') {
        candidates.set(stat.id, stat)
      }
      if (stat.type === 'inbound-rtp') {
        inbound.push(describeMediaFlowStats(stat))
      }
      if (stat.type === 'outbound-rtp') {
        outbound.push(describeMediaFlowStats(stat))
      }
    })

    const transportSnapshot = transportStat as
      | (RTCStats & {
          selectedCandidatePairId?: string
        })
      | null

    if (!selectedPair && transportSnapshot) {
      const selectedPairId = transportSnapshot.selectedCandidatePairId
      if (typeof selectedPairId === 'string' && selectedPairId.length > 0) {
        selectedPair = report.get(selectedPairId) ?? null
      }
    }

    if (!selectedPair) {
      const transport = describeTransportStats(transportStat)
      const totalBytes = (transport?.bytesReceived ?? 0) + (transport?.bytesSent ?? 0)
      return {
        hasSelectedCandidatePair: false,
        totalBytes,
        hadSuccessfulTransport: hadSuccessfulTransport || totalBytes > 0,
        localCandidate: null,
        remoteCandidate: null,
        transport,
        inbound,
        outbound
      }
    }

    const pair = selectedPair as RTCStats & {
      localCandidateId?: string
      remoteCandidateId?: string
      bytesReceived?: number
      bytesSent?: number
    }
    const localCandidate = pair.localCandidateId
      ? (candidates.get(pair.localCandidateId) ?? null)
      : null
    const remoteCandidate = pair.remoteCandidateId
      ? (candidates.get(pair.remoteCandidateId) ?? null)
      : null
    const totalBytes = (pair.bytesReceived ?? 0) + (pair.bytesSent ?? 0)

    return {
      hasSelectedCandidatePair: true,
      totalBytes,
      hadSuccessfulTransport: hadSuccessfulTransport || totalBytes > 0,
      localCandidate: describeCandidateStats(localCandidate),
      remoteCandidate: describeCandidateStats(remoteCandidate),
      transport: describeTransportStats(transportStat),
      inbound,
      outbound
    }
  }
}

function createPeerRecoveryState(): PeerRuntimeRecoveryState {
  return {
    transportMode: 'all',
    checkingTimer: null,
    recoveryInFlight: false,
    lastRecoveryAt: null,
    hadSuccessfulTransport: false
  }
}

function syncPreviewTrack(
  stream: MediaStream,
  kind: 'audio' | 'video',
  nextTrack: MediaStreamTrack | null
) {
  for (const track of stream.getTracks()) {
    if (track.kind === kind && track !== nextTrack) {
      stream.removeTrack(track)
    }
  }

  if (nextTrack && !stream.getTracks().includes(nextTrack)) {
    stream.addTrack(nextTrack)
  }
}

function parseSlotKind(value: string): SlotKind | null {
  if (value === 'audio' || value === 'camera' || value === 'screen' || value === 'screenAudio') {
    return value
  }

  return null
}

function describePeer(pc: RTCPeerConnection | null): PeerDiagnostics {
  if (!pc) {
    return {
      signalingState: 'not-created',
      connectionState: 'not-created',
      iceConnectionState: 'not-created'
    }
  }

  return {
    signalingState: pc.signalingState,
    connectionState: pc.connectionState,
    iceConnectionState: pc.iceConnectionState
  }
}

function describeCandidateStats(stat: RTCStats | null) {
  if (!stat) {
    return null
  }

  const candidate = stat as RTCStats & {
    candidateType?: string
    protocol?: string
    address?: string
    port?: number
    relayProtocol?: string
    networkType?: string
    url?: string
  }

  return {
    candidateType: candidate.candidateType ?? null,
    protocol: candidate.protocol ?? null,
    address: candidate.address ?? null,
    port: candidate.port ?? null,
    relayProtocol: candidate.relayProtocol ?? null,
    networkType: candidate.networkType ?? null,
    url: candidate.url ?? null
  }
}

function describeTransportStats(stat: RTCStats | null) {
  if (!stat) {
    return null
  }

  const transport = stat as RTCStats & {
    dtlsState?: string
    iceState?: string
    bytesReceived?: number
    bytesSent?: number
    packetsReceived?: number
    packetsSent?: number
    selectedCandidatePairId?: string
  }

  return {
    dtlsState: transport.dtlsState ?? null,
    iceState: transport.iceState ?? null,
    bytesReceived: transport.bytesReceived ?? null,
    bytesSent: transport.bytesSent ?? null,
    packetsReceived: transport.packetsReceived ?? null,
    packetsSent: transport.packetsSent ?? null,
    selectedCandidatePairId: transport.selectedCandidatePairId ?? null
  }
}

function describeMediaFlowStats(stat: RTCStats) {
  const flow = stat as RTCStats & {
    kind?: string
    mediaType?: string
    mid?: string
    bytesReceived?: number
    bytesSent?: number
    packetsReceived?: number
    packetsSent?: number
    framesDecoded?: number
    framesReceived?: number
    framesEncoded?: number
    frameWidth?: number
    frameHeight?: number
    jitter?: number
    trackIdentifier?: string
    decoderImplementation?: string
    encoderImplementation?: string
    pliCount?: number
    firCount?: number
    nackCount?: number
  }

  return {
    id: flow.id,
    type: flow.type,
    kind: flow.kind ?? flow.mediaType ?? null,
    mid: flow.mid ?? null,
    bytesReceived: flow.bytesReceived ?? null,
    bytesSent: flow.bytesSent ?? null,
    packetsReceived: flow.packetsReceived ?? null,
    packetsSent: flow.packetsSent ?? null,
    framesDecoded: flow.framesDecoded ?? null,
    framesReceived: flow.framesReceived ?? null,
    framesEncoded: flow.framesEncoded ?? null,
    frameWidth: flow.frameWidth ?? null,
    frameHeight: flow.frameHeight ?? null,
    jitter: flow.jitter ?? null,
    trackIdentifier: flow.trackIdentifier ?? null,
    decoderImplementation: flow.decoderImplementation ?? null,
    encoderImplementation: flow.encoderImplementation ?? null,
    pliCount: flow.pliCount ?? null,
    firCount: flow.firCount ?? null,
    nackCount: flow.nackCount ?? null
  }
}
