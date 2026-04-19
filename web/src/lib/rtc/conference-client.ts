import { SignalingClient, type SignalingState } from '@/lib/signaling'
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
} from '@/features/protocol/types'
import { logError, logInfo, logWarn } from '@/lib/logger'

type LocalPeerKind = 'publisher' | 'subscriber'

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
  }
  remoteStreams: number
  recentSignalsSent: string[]
  recentSignalsReceived: string[]
  lastError: string | null
}

type ConferenceEvents = {
  onSnapshot: (snapshot: RoomSnapshot) => void
  onSlotUpdated: (payload: SlotUpdatedPayload) => void
  onRemoteTrack: (participantId: string, kind: SlotKind, stream: MediaStream) => void
  onLocalStream?: (stream: MediaStream | null) => void
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
  private localAudioTrack: MediaStreamTrack | null = null
  private localCameraTrack: MediaStreamTrack | null = null
  private localScreenTrack: MediaStreamTrack | null = null
  private localPreviewStream: MediaStream | null = null
  private remoteStreams = new Map<string, MediaStream>()
  private makingPublisherOffer = false
  private allowPublisherNegotiation = false
  private pendingPublisherCandidates: RTCIceCandidateInit[] = []
  private pendingSubscriberCandidates: RTCIceCandidateInit[] = []
  private signalingState: SignalingState = 'idle'
  private recentSignalsSent: string[] = []
  private recentSignalsReceived: string[] = []
  private lastError: string | null = null

  constructor(private events: ConferenceEvents) {}

  async start(options: StartOptions) {
    try {
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

      this.publisherPc = this.createPeerConnection(options.iceServers, 'publisher')
      this.subscriberPc = this.createPeerConnection(options.iceServers, 'subscriber')
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

      if (!this.localAudioTrack) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
        this.localAudioTrack = stream.getAudioTracks()[0] ?? null
        await this.audioTransceiver.sender.replaceTrack(this.localAudioTrack)
      }

      if (this.localAudioTrack) {
        this.localAudioTrack.enabled = enabled
      }

      this.publishLocalStream()
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

      this.publishLocalStream()
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
      if (!this.screenTransceiver) {
        return
      }

      if (enabled) {
        const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false })
        this.localScreenTrack = stream.getVideoTracks()[0] ?? null
        if (this.localScreenTrack) {
          this.localScreenTrack.addEventListener('ended', () => {
            void this.setScreenEnabled(false)
          })
        }
        await this.screenTransceiver.sender.replaceTrack(this.localScreenTrack)
      } else {
        await this.screenTransceiver.sender.replaceTrack(null)
        this.localScreenTrack?.stop()
        this.localScreenTrack = null
      }

      this.publishLocalStream()
      this.sendSlotUpdate('screen', enabled, enabled, Boolean(this.localScreenTrack))
      this.emitDiagnostics()
      logInfo('rtc', 'screen share toggled', { enabled })
    } catch (error) {
      this.captureError(error)
      throw error
    }
  }

  close() {
    this.allowPublisherNegotiation = false
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
    this.localPreviewStream = null
    this.events.onLocalStream?.(null)
    this.emitDiagnostics()
    logInfo('rtc', 'conference client closed')
  }

  private createPeerConnection(iceServers: ICEServerConfig[], peer: LocalPeerKind) {
    const pc = new RTCPeerConnection({
      iceServers: iceServers.map((server) => ({
        urls: server.urls,
        username: server.username,
        credential: server.credential
      }))
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
      if (peer === 'publisher' && (pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'failed')) {
        void this.restartPublisherIce()
      }
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
        const slotKind = (event.track.id as SlotKind) || inferSlotKind(event.track.kind)
        const remoteStream = this.remoteStreams.get(participantId) ?? new MediaStream()
        remoteStream.addTrack(event.track)
        this.remoteStreams.set(participantId, remoteStream)
        this.events.onRemoteTrack(participantId, slotKind, remoteStream)
        this.emitDiagnostics()
        logInfo('rtc', 'remote track attached', {
          participantId,
          slotKind,
          trackKind: event.track.kind,
          trackId: event.track.id,
          streamId: stream?.id ?? 'unknown'
        })
      }
    }

    return pc
  }

  private reservePublisherSlots() {
    if (!this.publisherPc) {
      return
    }

    this.audioTransceiver = this.publisherPc.addTransceiver('audio', { direction: 'sendonly' })
    this.cameraTransceiver = this.publisherPc.addTransceiver('video', { direction: 'sendonly' })
    this.screenTransceiver = this.publisherPc.addTransceiver('video', { direction: 'sendonly' })
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

  private async logPeerStatsSnapshot(
    pc: RTCPeerConnection,
    peer: LocalPeerKind,
    reason: RTCIceConnectionState
  ) {
    if (!['checking', 'connected', 'disconnected', 'failed'].includes(reason)) {
      return
    }

    try {
      const report = await pc.getStats()
      let selectedPair: RTCStats | null = null
      const candidates = new Map<string, RTCStats>()

      report.forEach((stat) => {
        if (stat.type === 'candidate-pair' && 'selected' in stat && stat.selected) {
          selectedPair = stat
        }
        if (stat.type === 'local-candidate' || stat.type === 'remote-candidate') {
          candidates.set(stat.id, stat)
        }
      })

      if (!selectedPair) {
        logInfo('rtc', 'peer stats snapshot', { peer, reason, selectedPair: 'none' })
        return
      }

      const pair = selectedPair as RTCStats & {
        id?: string
        state?: string
        localCandidateId?: string
        remoteCandidateId?: string
        currentRoundTripTime?: number
        availableOutgoingBitrate?: number
        bytesReceived?: number
        bytesSent?: number
        packetsReceived?: number
        packetsSent?: number
      }
      const localCandidate = pair.localCandidateId ? (candidates.get(pair.localCandidateId) ?? null) : null
      const remoteCandidate = pair.remoteCandidateId ? (candidates.get(pair.remoteCandidateId) ?? null) : null

      logInfo('rtc', 'peer stats snapshot', {
        peer,
        reason,
        pairId: pair.id,
        state: pair.state ?? 'unknown',
        currentRoundTripTime: pair.currentRoundTripTime ?? null,
        availableOutgoingBitrate: pair.availableOutgoingBitrate ?? null,
        bytesSent: pair.bytesSent ?? null,
        bytesReceived: pair.bytesReceived ?? null,
        packetsSent: pair.packetsSent ?? null,
        packetsReceived: pair.packetsReceived ?? null,
        localCandidate: describeCandidateStats(localCandidate),
        remoteCandidate: describeCandidateStats(remoteCandidate)
      })
    } catch (error) {
      logWarn('rtc', 'peer stats snapshot failed', {
        peer,
        reason,
        error: error instanceof Error ? error.message : String(error)
      })
    }
  }

  private sendSlotUpdate(kind: SlotKind, enabled: boolean, publishing: boolean, trackBound: boolean) {
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
      const offer = await this.publisherPc.createOffer(iceRestart ? { iceRestart: true } : undefined)
      await this.publisherPc.setLocalDescription(offer)
      this.sendSignal<SessionDescriptionPayload>({
        type: 'publisher.offer',
        payload: {
          peer: 'publisher',
          description: offer
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
        screenTrack: Boolean(this.localScreenTrack)
      },
      remoteStreams: this.remoteStreams.size,
      recentSignalsSent: [...this.recentSignalsSent],
      recentSignalsReceived: [...this.recentSignalsReceived],
      lastError: this.lastError
    })
  }

  private publishLocalStream() {
    const preferredVideoTrack = this.localScreenTrack ?? this.localCameraTrack
    const desiredTracks = [this.localAudioTrack, preferredVideoTrack].filter(
      (track): track is MediaStreamTrack => Boolean(track)
    )

    if (desiredTracks.length === 0) {
      this.localPreviewStream = null
      this.events.onLocalStream?.(null)
      return
    }

    if (!this.localPreviewStream) {
      this.localPreviewStream = new MediaStream()
    }

    syncPreviewTrack(this.localPreviewStream, 'audio', this.localAudioTrack)
    syncPreviewTrack(this.localPreviewStream, 'video', preferredVideoTrack)
    this.events.onLocalStream?.(this.localPreviewStream)
  }
}

function syncPreviewTrack(stream: MediaStream, kind: 'audio' | 'video', nextTrack: MediaStreamTrack | null) {
  for (const track of stream.getTracks()) {
    if (track.kind === kind && track !== nextTrack) {
      stream.removeTrack(track)
    }
  }

  if (nextTrack && !stream.getTracks().includes(nextTrack)) {
    stream.addTrack(nextTrack)
  }
}

function inferSlotKind(kind: string): SlotKind {
  return kind === 'audio' ? 'audio' : 'camera'
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
