import type { NoInputUseCase, StateFlow } from '@kvt/core'
import type { LocalMediaState } from '../model'
import type { LocalPreviewRepository } from '../repository/LocalPreviewRepository'

export class ObserveLocalMediaUseCase implements NoInputUseCase<StateFlow<LocalMediaState>> {
  constructor(private readonly repository: LocalPreviewRepository) {}

  execute(): StateFlow<LocalMediaState> {
    return this.repository.state
  }
}
