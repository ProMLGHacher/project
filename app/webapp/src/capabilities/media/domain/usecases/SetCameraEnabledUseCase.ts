import type { PromiseResult, UseCase } from '@kvt/core'
import type { MediaError } from '../model'
import type { LocalPreviewRepository } from '../repository/LocalPreviewRepository'

export class SetCameraEnabledUseCase implements UseCase<boolean, PromiseResult<void, MediaError>> {
  constructor(private readonly repository: LocalPreviewRepository) {}

  execute(enabled: boolean): PromiseResult<void, MediaError> {
    return this.repository.setCameraEnabled(enabled)
  }
}
