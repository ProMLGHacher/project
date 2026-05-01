import { MutableStateFlow, err, ok, type PromiseResult } from '@kvt/core'
import {
  createDefaultAudioProcessingSettings,
  normalizePluginChain,
  type AudioPluginInstance,
  type AudioProcessingMeter,
  type AudioProcessingSettings,
  type AudioProcessingState,
  type CreateProcessedMicrophoneStreamParams
} from '@capabilities/audio-processing/domain/model'
import type {
  AudioProcessingError,
  AudioProcessingRepository
} from '@capabilities/audio-processing/domain/repository/AudioProcessingRepository'

type AudioGraph = {
  readonly owner: string
  readonly rawStream: MediaStream
  readonly context: AudioContext
  readonly source: MediaStreamAudioSourceNode
  readonly destination: MediaStreamAudioDestinationNode
  readonly monitorGain: GainNode
  analyser: AnalyserNode | null
  nodes: AudioNode[]
}

const emptyMeter: AudioProcessingMeter = {
  levelDb: -90,
  spectrum: Array.from({ length: 24 }, () => 0)
}

export class BrowserAudioProcessingRepository implements AudioProcessingRepository {
  private readonly stateFlow = new MutableStateFlow<AudioProcessingState>({
    settings: createDefaultAudioProcessingSettings(),
    meter: emptyMeter
  })
  private readonly graphs = new Map<string, AudioGraph>()
  private meterTimer: number | null = null

  readonly state = this.stateFlow.asStateFlow()

  configure(settings: AudioProcessingSettings): void {
    this.setSettings(settings)
  }

  setChain(chain: readonly AudioPluginInstance[]): void {
    this.setSettings({
      ...this.stateFlow.value.settings,
      chain: normalizePluginChain(chain)
    })
  }

  setMonitorEnabled(enabled: boolean): void {
    this.setSettings({
      ...this.stateFlow.value.settings,
      monitorEnabled: enabled
    })
  }

  async createProcessedMicrophoneStream({
    owner,
    rawStream
  }: CreateProcessedMicrophoneStreamParams): PromiseResult<MediaStream, AudioProcessingError> {
    const AudioContextConstructor = window.AudioContext ?? window.webkitAudioContext

    if (!AudioContextConstructor) {
      return err({ type: 'api-unavailable' })
    }

    const audioTrack = rawStream.getAudioTracks()[0]
    if (!audioTrack) {
      return err({ type: 'stream-unavailable' })
    }

    try {
      this.release(owner)

      const context = new AudioContextConstructor()
      const source = context.createMediaStreamSource(rawStream)
      const destination = context.createMediaStreamDestination()
      const monitorGain = context.createGain()
      monitorGain.gain.value = this.stateFlow.value.settings.monitorEnabled ? 1 : 0
      monitorGain.connect(context.destination)

      const graph: AudioGraph = {
        owner,
        rawStream,
        context,
        source,
        destination,
        monitorGain,
        analyser: null,
        nodes: []
      }

      this.graphs.set(owner, graph)
      this.rebuildGraph(graph)
      this.ensureMeterTimer()

      return ok(destination.stream)
    } catch (error) {
      return err({ type: 'unknown-error', message: readableError(error) })
    }
  }

  release(owner: string): void {
    const graph = this.graphs.get(owner)
    if (!graph) {
      return
    }

    disconnectGraph(graph)
    graph.monitorGain.disconnect()
    graph.rawStream.getTracks().forEach((track) => track.stop())
    void graph.context.close().catch(() => undefined)
    this.graphs.delete(owner)

    if (!this.graphs.size) {
      this.stopMeterTimer()
      this.patchMeter(emptyMeter)
    }
  }

  private setSettings(settings: AudioProcessingSettings): void {
    const normalizedSettings = {
      ...settings,
      chain: normalizePluginChain(settings.chain)
    }

    this.stateFlow.update((state) => ({
      ...state,
      settings: normalizedSettings
    }))

    for (const graph of this.graphs.values()) {
      this.rebuildGraph(graph)
      graph.monitorGain.gain.setTargetAtTime(
        normalizedSettings.monitorEnabled ? 1 : 0,
        graph.context.currentTime,
        0.015
      )
    }
  }

  private rebuildGraph(graph: AudioGraph): void {
    disconnectGraph(graph)

    const context = graph.context
    const nodes: AudioNode[] = []
    const analyser = context.createAnalyser()
    analyser.fftSize = 256
    analyser.smoothingTimeConstant = 0.82

    let current: AudioNode = graph.source
    current.connect(analyser)
    current = analyser
    graph.analyser = analyser

    for (const plugin of this.stateFlow.value.settings.chain) {
      if (!plugin.enabled) {
        continue
      }

      const pluginNodes = createPluginNodes(context, plugin)
      if (!pluginNodes.length) {
        continue
      }

      for (const node of pluginNodes) {
        current.connect(node)
        current = node
      }

      nodes.push(...pluginNodes)
    }

    current.connect(graph.destination)
    current.connect(graph.monitorGain)
    graph.nodes = [analyser, ...nodes]
  }

  private ensureMeterTimer(): void {
    if (this.meterTimer !== null) {
      return
    }

    this.meterTimer = window.setInterval(() => this.updateMeter(), 50)
  }

  private stopMeterTimer(): void {
    if (this.meterTimer === null) {
      return
    }

    window.clearInterval(this.meterTimer)
    this.meterTimer = null
  }

  private updateMeter(): void {
    const analyser = this.graphs.values().next().value?.analyser
    if (!analyser) {
      this.patchMeter(emptyMeter)
      return
    }

    const timeData = new Uint8Array(analyser.fftSize)
    const frequencyData = new Uint8Array(analyser.frequencyBinCount)
    analyser.getByteTimeDomainData(timeData)
    analyser.getByteFrequencyData(frequencyData)

    let sumSquares = 0
    for (const sample of timeData) {
      const normalized = (sample - 128) / 128
      sumSquares += normalized * normalized
    }

    const rms = Math.sqrt(sumSquares / timeData.length)
    const levelDb = Math.max(-90, 20 * Math.log10(rms || 0.00001))
    const bucketCount = 24
    const bucketSize = Math.max(1, Math.floor(frequencyData.length / bucketCount))
    const spectrum = Array.from({ length: bucketCount }, (_, bucketIndex) => {
      let total = 0
      for (let index = 0; index < bucketSize; index += 1) {
        total += frequencyData[bucketIndex * bucketSize + index] ?? 0
      }
      return total / bucketSize / 255
    })

    this.patchMeter({ levelDb, spectrum })
  }

  private patchMeter(meter: AudioProcessingMeter): void {
    this.stateFlow.update((state) => ({
      ...state,
      meter
    }))
  }
}

declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext
  }
}

function createPluginNodes(context: AudioContext, plugin: AudioPluginInstance): AudioNode[] {
  switch (plugin.kind) {
    case 'volume': {
      const gain = context.createGain()
      gain.gain.value = plugin.config.gain
      return [gain]
    }
    case 'noiseGate':
      return [createNoiseGateNode(context, plugin.config)]
    case 'compressor': {
      const compressor = context.createDynamicsCompressor()
      compressor.threshold.value = plugin.config.thresholdDb
      compressor.ratio.value = plugin.config.ratio
      compressor.attack.value = plugin.config.attackMs / 1000
      compressor.release.value = plugin.config.releaseMs / 1000
      const makeupGain = context.createGain()
      makeupGain.gain.value = plugin.config.makeupGain
      return [compressor, makeupGain]
    }
    case 'equalizer10':
      return plugin.config.gainsDb.map((gainDb, index) => {
        const filter = context.createBiquadFilter()
        filter.type = 'peaking'
        filter.frequency.value =
          [31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000][index] ?? 1000
        filter.Q.value = 1.05
        filter.gain.value = gainDb
        return filter
      })
    case 'saturator': {
      const shaper = context.createWaveShaper()
      shaper.curve = createSaturationCurve(plugin.config.drive)
      shaper.oversample = '4x'
      const output = context.createGain()
      output.gain.value = plugin.config.outputGain * (0.85 + plugin.config.mix * 0.15)
      return [shaper, output]
    }
  }
}

function createNoiseGateNode(
  context: AudioContext,
  config: Extract<AudioPluginInstance, { kind: 'noiseGate' }>['config']
): ScriptProcessorNode {
  const processor = context.createScriptProcessor(1024, 2, 2)
  let gain = 1

  processor.onaudioprocess = (event) => {
    const input = event.inputBuffer
    const output = event.outputBuffer
    const channelCount = Math.min(input.numberOfChannels, output.numberOfChannels)
    const firstChannel = input.getChannelData(0)
    let sumSquares = 0

    for (let index = 0; index < firstChannel.length; index += 1) {
      sumSquares += firstChannel[index] * firstChannel[index]
    }

    const rms = Math.sqrt(sumSquares / firstChannel.length)
    const levelDb = 20 * Math.log10(rms || 0.00001)
    const targetGain = levelDb < config.thresholdDb ? 0 : 1
    const blockSeconds = firstChannel.length / context.sampleRate
    const timeMs = targetGain > gain ? config.attackMs : config.releaseMs
    const coefficient = Math.exp(-blockSeconds / Math.max(0.001, timeMs / 1000))
    gain = targetGain + (gain - targetGain) * coefficient

    // Noise gate intentionally lives in capability: UI only draws meter, processing stays outside React.
    for (let channel = 0; channel < channelCount; channel += 1) {
      const inputData = input.getChannelData(channel)
      const outputData = output.getChannelData(channel)
      for (let index = 0; index < inputData.length; index += 1) {
        outputData[index] = inputData[index] * gain
      }
    }
  }

  return processor
}

function createSaturationCurve(drive: number): Float32Array<ArrayBuffer> {
  const samples = 1024
  const curve: Float32Array<ArrayBuffer> = new Float32Array(
    new ArrayBuffer(samples * Float32Array.BYTES_PER_ELEMENT)
  )
  const amount = Math.max(0, drive)

  for (let index = 0; index < samples; index += 1) {
    const x = (index * 2) / samples - 1
    curve[index] = ((1 + amount) * x) / (1 + amount * Math.abs(x))
  }

  return curve
}

function disconnectGraph(graph: AudioGraph): void {
  graph.source.disconnect()
  graph.destination.disconnect()
  graph.nodes.forEach((node) => node.disconnect())
}

function readableError(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
