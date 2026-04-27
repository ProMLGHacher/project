import type { NoInputUseCase } from '@kvt/core'
import type { VoiceActivityRepository } from '../repository/VoiceActivityRepository'

export class StopVoiceActivityUseCase implements NoInputUseCase<void> {
  constructor(private readonly repository: VoiceActivityRepository) {}

  execute(): void {
    this.repository.stop()
  }
}
