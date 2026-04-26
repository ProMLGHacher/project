import type { UseCase } from '@kvt/core'
import type { ConferenceSound } from '../model/ConferenceSound'
import type { ConferenceAudioRepository } from '../repository/ConferenceAudioRepository'

export class PlayConferenceSoundUseCase implements UseCase<ConferenceSound, void> {
  constructor(private readonly conferenceAudioRepository: ConferenceAudioRepository) {}

  execute(sound: ConferenceSound): void {
    this.conferenceAudioRepository.play(sound)
  }
}

