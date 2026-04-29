import type { UseCase } from '@kvt/core'
import type { LocalPreviewRepository } from '../repository/LocalPreviewRepository'

export class SetNoiseSuppressionUseCase implements UseCase<boolean, void> {
  constructor(private readonly repository: LocalPreviewRepository) {}

  execute(enabled: boolean): void {
    this.repository.setNoiseSuppressionEnabled(enabled)
  }
}
