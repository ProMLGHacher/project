import type { PromiseResult, UseCase } from '@kvt/core'
import type { MediaError, StartLocalPreviewParams } from '../model'
import type { LocalPreviewRepository } from '../repository/LocalPreviewRepository'

export class StartLocalPreviewUseCase implements UseCase<
  StartLocalPreviewParams,
  PromiseResult<void, MediaError>
> {
  constructor(private readonly repository: LocalPreviewRepository) {}

  execute(params: StartLocalPreviewParams): PromiseResult<void, MediaError> {
    return this.repository.startPreview(params)
  }
}
