import type { NoInputUseCase, StateFlow } from '@kvt/core'
import type { VoiceActivityRepository } from '../repository/VoiceActivityRepository'

export class ObserveVoiceActivityUseCase implements NoInputUseCase<StateFlow<readonly string[]>> {
  constructor(private readonly repository: VoiceActivityRepository) {}

  execute(): StateFlow<readonly string[]> {
    return this.repository.speakingParticipantIds
  }
}
