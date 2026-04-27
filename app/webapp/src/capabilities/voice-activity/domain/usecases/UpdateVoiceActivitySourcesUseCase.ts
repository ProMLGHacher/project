import type { UseCase } from '@kvt/core'
import type { VoiceActivitySource } from '../model/VoiceActivitySource'
import type { VoiceActivityRepository } from '../repository/VoiceActivityRepository'

export class UpdateVoiceActivitySourcesUseCase implements UseCase<
  readonly VoiceActivitySource[],
  void
> {
  constructor(private readonly repository: VoiceActivityRepository) {}

  execute(sources: readonly VoiceActivitySource[]): void {
    this.repository.observeSources(sources)
  }
}
