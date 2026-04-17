import { SignalingClient } from '@/lib/signaling'
import type {
  CandidatePayload,
  ICEServerConfig,
  IceRestartPayload,
  RoomSnapshot,
  RoomSnapshotPayload,
  SessionDescriptionPayload,
  SignalEnvelope,
  SignalPeer,
  SlotKind,
  SlotUpdatedPayload
} from '@/features/protocol/types'

type LocalPeerKind = 'publisher' | 'subscriber'

type ConferenceEvents = {
  onSnapshot: (snapshot: RoomSnapshot) => void
  onSlotUpdated: (payload: SlotUpdatedPayload) => void
  onRemoteTrack: (participantId: string, kind: SlotKind, stream: MediaStream) => void
  onStateChange: (state: string) => void
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
  private remoteStreams = new Map<string, MediaStream>()
  private makingPublisherOffer = false
  private allowPublisherNegotiation = false
  private pendingPublisherCandidates: RTCIceCandidateInit[] = []
  private pendingSubscriberCandidates: RTCIceCandidateInit[] = []

  constructor(private events: ConferenceEvents) {}

  async start(options: StartOptions) {
    this.events.onStateChange('connecting')
    await this.signaling.connect(options.wsUrl)
    this.signaling.subscribe((message) => {
      void this.handleSignalMessage(message)
    })

    this.publisherPc = this.createPeerConnection(options.iceServers, 'publisher')
    this.subscriberPc = this.createPeerConnection(options.iceServers, 'subscriber')
    this.reservePublisherSlots()

    await this.setMicEnabled(options.micEnabled)
    await this.setCameraEnabled(options.cameraEnabled)
    this.allowPublisherNegotiation = true
    await this.negotiatePublisher()
  }

  async setMicEnabled(enabled: boolean) {
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

    this.sendSlotUpdate('audio', enabled, enabled, Boolean(this.localAudioTrack))
  }

  async setCameraEnabled(enabled: boolean) {
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

    this.sendSlotUpdate('camera', enabled, enabled, Boolean(this.localCameraTrack))
  }

  async setScreenEnabled(enabled: boolean) {
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

    this.sendSlotUpdate('screen', enabled, enabled, Boolean(this.localScreenTrack))
  }

  close() {
    this.allowPublisherNegotiation = false
    this.signaling.close()
    this.publisherPc?.close()
    this.subscriberPc?.close()
    this.localAudioTrack?.stop()
    this.localCameraTrack?.stop()
    this.localScreenTrack?.stop()
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

      this.signaling.send<CandidatePayload>({
        type: 'trickle.candidate',
        payload: {
          peer,
          candidate: event.candidate.toJSON()
        }
      })
    }

    pc.oniceconnectionstatechange = () => {
      this.events.onStateChange(pc.iceConnectionState)
      if (peer === 'publisher' && (pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'failed')) {
        void this.restartPublisherIce()
      }
    }

    if (peer === 'publisher') {
      pc.onnegotiationneeded = async () => {
        await this.negotiatePublisher()
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
        this.signaling.send<SessionDescriptionPayload>({
          type: 'subscriber.answer',
          payload: {
            peer: 'subscriber',
            description: answer
          }
        })
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
        return
      }
      case 'media.slot.updated': {
        this.events.onSlotUpdated(message.payload as SlotUpdatedPayload)
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
        return
    }
  }

  private async restartPublisherIce() {
    await this.negotiatePublisher(true)
  }

  private sendSlotUpdate(kind: SlotKind, enabled: boolean, publishing: boolean, trackBound: boolean) {
    this.signaling.send<SlotUpdatedPayload>({
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
      this.signaling.send<SessionDescriptionPayload>({
        type: 'publisher.offer',
        payload: {
          peer: 'publisher',
          description: offer
        }
      })
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
}

function inferSlotKind(kind: string): SlotKind {
  return kind === 'audio' ? 'audio' : 'camera'
}
