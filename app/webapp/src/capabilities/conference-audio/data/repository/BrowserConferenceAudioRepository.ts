import type { ConferenceSound } from '@capabilities/conference-audio/domain/model/ConferenceSound'
import type { ConferenceAudioRepository } from '@capabilities/conference-audio/domain/repository/ConferenceAudioRepository'

type BrowserAudioContext = typeof AudioContext

type Tone = {
  readonly frequency: number
  readonly start: number
  readonly duration: number
  readonly gain: number
}

type SoundPreset = {
  readonly type: OscillatorType
  readonly tones: readonly Tone[]
}

const soundPresets = {
  'microphone-on': {
    type: 'sine',
    tones: [
      { frequency: 440, start: 0, duration: 0.055, gain: 0.035 },
      { frequency: 660, start: 0.055, duration: 0.08, gain: 0.032 }
    ]
  },
  'microphone-off': {
    type: 'sine',
    tones: [
      { frequency: 660, start: 0, duration: 0.055, gain: 0.033 },
      { frequency: 360, start: 0.055, duration: 0.09, gain: 0.03 }
    ]
  },
  'camera-on': {
    type: 'triangle',
    tones: [
      { frequency: 520, start: 0, duration: 0.045, gain: 0.032 },
      { frequency: 780, start: 0.045, duration: 0.045, gain: 0.03 },
      { frequency: 1040, start: 0.09, duration: 0.08, gain: 0.026 }
    ]
  },
  'camera-off': {
    type: 'triangle',
    tones: [
      { frequency: 1040, start: 0, duration: 0.045, gain: 0.028 },
      { frequency: 700, start: 0.045, duration: 0.045, gain: 0.029 },
      { frequency: 460, start: 0.09, duration: 0.08, gain: 0.03 }
    ]
  },
  'screen-share-incoming': {
    type: 'sine',
    tones: [
      { frequency: 392, start: 0, duration: 0.08, gain: 0.026 },
      { frequency: 587, start: 0.07, duration: 0.08, gain: 0.03 },
      { frequency: 880, start: 0.14, duration: 0.12, gain: 0.032 }
    ]
  },
  'screen-share-outgoing': {
    type: 'sine',
    tones: [
      { frequency: 880, start: 0, duration: 0.08, gain: 0.032 },
      { frequency: 587, start: 0.07, duration: 0.08, gain: 0.028 },
      { frequency: 392, start: 0.14, duration: 0.12, gain: 0.024 }
    ]
  },
  'participant-incoming': {
    type: 'triangle',
    tones: [
      { frequency: 494, start: 0, duration: 0.07, gain: 0.028 },
      { frequency: 659, start: 0.07, duration: 0.07, gain: 0.03 },
      { frequency: 988, start: 0.14, duration: 0.11, gain: 0.028 }
    ]
  },
  'participant-outgoing': {
    type: 'triangle',
    tones: [
      { frequency: 988, start: 0, duration: 0.07, gain: 0.028 },
      { frequency: 659, start: 0.07, duration: 0.07, gain: 0.027 },
      { frequency: 494, start: 0.14, duration: 0.12, gain: 0.024 }
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
      window.AudioContext ?? (window as unknown as { webkitAudioContext?: BrowserAudioContext })
        .webkitAudioContext

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
    gain.gain.setValueAtTime(0.0001, startTime)
    gain.gain.exponentialRampToValueAtTime(tone.gain, startTime + 0.012)
    gain.gain.exponentialRampToValueAtTime(0.0001, endTime)

    oscillator.connect(gain).connect(context.destination)
    oscillator.start(startTime)
    oscillator.stop(endTime + 0.01)
  }
}

