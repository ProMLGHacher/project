import { MutableStateFlow } from '@kvt/core'
import type { VoiceActivitySource } from '@capabilities/voice-activity/domain/model/VoiceActivitySource'
import type { VoiceActivityRepository } from '@capabilities/voice-activity/domain/repository/VoiceActivityRepository'

type BrowserAudioContext = typeof AudioContext

type Monitor = {
  readonly id: string
  readonly stream: MediaStream
  readonly context: AudioContext
  readonly analyser: AnalyserNode
  readonly source: MediaStreamAudioSourceNode
  readonly samples: Uint8Array<ArrayBuffer>
  frameId: number
  speaking: boolean
}

const speakingThreshold = 0.035

export class BrowserVoiceActivityRepository implements VoiceActivityRepository {
  private readonly speakingIds = new MutableStateFlow<readonly string[]>([])
  private readonly monitors = new Map<string, Monitor>()

  readonly speakingParticipantIds = this.speakingIds.asStateFlow()

  observeSources(sources: readonly VoiceActivitySource[]): void {
    const activeIds = new Set<string>()

    for (const source of sources) {
      activeIds.add(source.id)

      if (!source.enabled || !hasLiveAudio(source.stream)) {
        this.stopMonitor(source.id)
        continue
      }

      const monitor = this.monitors.get(source.id)
      if (monitor && monitor.stream !== source.stream) {
        this.stopMonitor(source.id)
      }

      if (!this.monitors.has(source.id) && source.stream) {
        this.startMonitor(source.id, source.stream)
      }
    }

    for (const id of this.monitors.keys()) {
      if (!activeIds.has(id)) {
        this.stopMonitor(id)
      }
    }

    this.publishSpeakingIds()
  }

  stop(): void {
    for (const id of [...this.monitors.keys()]) {
      this.stopMonitor(id)
    }

    this.speakingIds.set([])
  }

  private startMonitor(id: string, stream: MediaStream) {
    const AudioContextConstructor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: BrowserAudioContext }).webkitAudioContext

    if (!AudioContextConstructor) {
      return
    }

    const context = new AudioContextConstructor()
    const analyser = context.createAnalyser()
    const source = context.createMediaStreamSource(stream)
    analyser.fftSize = 512
    source.connect(analyser)

    if (context.state === 'suspended') {
      void context.resume().catch(() => undefined)
    }

    const monitor: Monitor = {
      id,
      stream,
      context,
      analyser,
      source,
      samples: new Uint8Array(new ArrayBuffer(analyser.fftSize)),
      frameId: 0,
      speaking: false
    }

    const update = () => {
      analyser.getByteTimeDomainData(monitor.samples)

      let total = 0
      for (const sample of monitor.samples) {
        const level = (sample - 128) / 128
        total += level * level
      }

      const speaking = Math.sqrt(total / monitor.samples.length) > speakingThreshold
      if (monitor.speaking !== speaking) {
        monitor.speaking = speaking
        this.publishSpeakingIds()
      }

      monitor.frameId = requestAnimationFrame(update)
    }

    this.monitors.set(id, monitor)
    monitor.frameId = requestAnimationFrame(update)
  }

  private stopMonitor(id: string) {
    const monitor = this.monitors.get(id)
    if (!monitor) {
      return
    }

    cancelAnimationFrame(monitor.frameId)
    monitor.source.disconnect()
    void monitor.context.close().catch(() => undefined)
    this.monitors.delete(id)
  }

  private publishSpeakingIds() {
    const next = [...this.monitors.values()]
      .filter((monitor) => monitor.speaking)
      .map((monitor) => monitor.id)

    const current = this.speakingIds.value
    if (current.length === next.length && current.every((id, index) => id === next[index])) {
      return
    }

    this.speakingIds.set(next)
  }
}

function hasLiveAudio(stream: MediaStream | null): boolean {
  return Boolean(stream?.getAudioTracks().some((track) => track.readyState === 'live'))
}
