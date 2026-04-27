import type { ConferenceSound } from '@capabilities/conference-audio/domain/model/ConferenceSound'
import type { ConferenceAudioRepository } from '@capabilities/conference-audio/domain/repository/ConferenceAudioRepository'

type BrowserAudioContext = typeof AudioContext

type Tone = {
  readonly frequency: number
  readonly start: number
  readonly duration: number
  readonly gain: number
  readonly detune?: number
}

type SoundPreset = {
  readonly type: OscillatorType
  readonly tones: readonly Tone[]
}

const soundPresets = {
  'conference-joined': {
    type: 'sine',
    tones: [
      { frequency: 196, start: 0, duration: 0.16, gain: 0.018 },
      { frequency: 392, start: 0.035, duration: 0.15, gain: 0.03 },
      { frequency: 587, start: 0.12, duration: 0.16, gain: 0.026 },
      { frequency: 784, start: 0.205, duration: 0.18, gain: 0.022 },
      { frequency: 1175, start: 0.24, duration: 0.09, gain: 0.012, detune: -7 }
    ]
  },
  'microphone-on': {
    type: 'sine',
    tones: [
      { frequency: 220, start: 0, duration: 0.11, gain: 0.014 },
      { frequency: 440, start: 0.025, duration: 0.095, gain: 0.03 },
      { frequency: 660, start: 0.095, duration: 0.11, gain: 0.027 },
      { frequency: 990, start: 0.15, duration: 0.08, gain: 0.014, detune: 5 }
    ]
  },
  'microphone-off': {
    type: 'sine',
    tones: [
      { frequency: 880, start: 0, duration: 0.065, gain: 0.022 },
      { frequency: 660, start: 0.045, duration: 0.09, gain: 0.028 },
      { frequency: 330, start: 0.115, duration: 0.14, gain: 0.024 },
      { frequency: 165, start: 0.155, duration: 0.12, gain: 0.012 }
    ]
  },
  'camera-on': {
    type: 'triangle',
    tones: [
      { frequency: 260, start: 0, duration: 0.1, gain: 0.012 },
      { frequency: 520, start: 0.025, duration: 0.09, gain: 0.026 },
      { frequency: 780, start: 0.09, duration: 0.09, gain: 0.024 },
      { frequency: 1040, start: 0.155, duration: 0.12, gain: 0.02 },
      { frequency: 1560, start: 0.2, duration: 0.08, gain: 0.01 }
    ]
  },
  'camera-off': {
    type: 'triangle',
    tones: [
      { frequency: 1040, start: 0, duration: 0.06, gain: 0.022 },
      { frequency: 780, start: 0.04, duration: 0.08, gain: 0.025 },
      { frequency: 520, start: 0.105, duration: 0.105, gain: 0.026 },
      { frequency: 260, start: 0.17, duration: 0.13, gain: 0.014 }
    ]
  },
  'screen-share-incoming': {
    type: 'sine',
    tones: [
      { frequency: 147, start: 0, duration: 0.22, gain: 0.014 },
      { frequency: 294, start: 0.035, duration: 0.18, gain: 0.02 },
      { frequency: 440, start: 0.11, duration: 0.16, gain: 0.027 },
      { frequency: 659, start: 0.19, duration: 0.16, gain: 0.028 },
      { frequency: 988, start: 0.275, duration: 0.16, gain: 0.02 }
    ]
  },
  'screen-share-outgoing': {
    type: 'sine',
    tones: [
      { frequency: 988, start: 0, duration: 0.13, gain: 0.024 },
      { frequency: 659, start: 0.07, duration: 0.14, gain: 0.027 },
      { frequency: 440, start: 0.145, duration: 0.16, gain: 0.023 },
      { frequency: 294, start: 0.235, duration: 0.18, gain: 0.016 },
      { frequency: 147, start: 0.3, duration: 0.2, gain: 0.012 }
    ]
  },
  'screen-share-stopped-incoming': {
    type: 'triangle',
    tones: [
      { frequency: 784, start: 0, duration: 0.08, gain: 0.018 },
      { frequency: 523, start: 0.055, duration: 0.11, gain: 0.022 },
      { frequency: 349, start: 0.13, duration: 0.14, gain: 0.018 },
      { frequency: 220, start: 0.215, duration: 0.15, gain: 0.012 }
    ]
  },
  'screen-share-stopped-outgoing': {
    type: 'triangle',
    tones: [
      { frequency: 880, start: 0, duration: 0.07, gain: 0.018 },
      { frequency: 587, start: 0.05, duration: 0.1, gain: 0.022 },
      { frequency: 392, start: 0.12, duration: 0.13, gain: 0.019 },
      { frequency: 196, start: 0.2, duration: 0.15, gain: 0.012 }
    ]
  },
  'participant-incoming': {
    type: 'triangle',
    tones: [
      { frequency: 247, start: 0, duration: 0.14, gain: 0.014 },
      { frequency: 494, start: 0.035, duration: 0.12, gain: 0.025 },
      { frequency: 659, start: 0.12, duration: 0.12, gain: 0.027 },
      { frequency: 988, start: 0.205, duration: 0.14, gain: 0.022 },
      { frequency: 1319, start: 0.26, duration: 0.08, gain: 0.01 }
    ]
  },
  'participant-outgoing': {
    type: 'triangle',
    tones: [
      { frequency: 988, start: 0, duration: 0.08, gain: 0.022 },
      { frequency: 659, start: 0.055, duration: 0.1, gain: 0.024 },
      { frequency: 494, start: 0.13, duration: 0.12, gain: 0.02 },
      { frequency: 247, start: 0.22, duration: 0.16, gain: 0.012 }
    ]
  }
} satisfies Record<ConferenceSound, SoundPreset>

export class BrowserConferenceAudioRepository implements ConferenceAudioRepository {
  private audioContext: AudioContext | null = null

  play(sound: ConferenceSound): void {
    const context = this.getAudioContext()

    if (!context) {
      return
    }

    if (context.state === 'suspended') {
      void context.resume().catch(() => undefined)
    }

    const preset = soundPresets[sound]
    const now = context.currentTime + 0.01

    for (const tone of preset.tones) {
      this.playTone(context, preset.type, now, tone)
    }
  }

  private getAudioContext(): AudioContext | null {
    if (this.audioContext) {
      return this.audioContext
    }

    const AudioContextConstructor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: BrowserAudioContext }).webkitAudioContext

    if (!AudioContextConstructor) {
      return null
    }

    this.audioContext = new AudioContextConstructor()
    return this.audioContext
  }

  private playTone(
    context: AudioContext,
    type: OscillatorType,
    baseTime: number,
    tone: Tone
  ): void {
    const oscillator = context.createOscillator()
    const gain = context.createGain()
    const startTime = baseTime + tone.start
    const endTime = startTime + tone.duration

    oscillator.type = type
    oscillator.frequency.setValueAtTime(tone.frequency, startTime)
    if (tone.detune !== undefined) {
      oscillator.detune.setValueAtTime(tone.detune, startTime)
    }
    gain.gain.setValueAtTime(0.0001, startTime)
    gain.gain.exponentialRampToValueAtTime(tone.gain, startTime + 0.012)
    gain.gain.exponentialRampToValueAtTime(0.0001, endTime)

    oscillator.connect(gain).connect(context.destination)
    oscillator.start(startTime)
    oscillator.stop(endTime + 0.01)
  }
}
