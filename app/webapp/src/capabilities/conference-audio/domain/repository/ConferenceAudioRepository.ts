import type { ConferenceSound } from '../model/ConferenceSound'

export interface ConferenceAudioRepository {
  play(sound: ConferenceSound): void
}

