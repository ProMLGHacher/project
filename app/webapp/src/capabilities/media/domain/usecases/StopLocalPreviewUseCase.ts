import type { NoInputUseCase } from '@kvt/core'
import type { LocalPreviewRepository } from '../repository/LocalPreviewRepository'

export class StopLocalPreviewUseCase implements NoInputUseCase<void> {
  constructor(private readonly repository: LocalPreviewRepository) {}

  execute(): void {
    this.repository.stopPreview()
  }
}
