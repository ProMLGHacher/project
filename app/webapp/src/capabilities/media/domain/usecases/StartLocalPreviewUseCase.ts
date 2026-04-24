import type { PromiseResult, UseCase } from '@kvt/core'
import type { MediaError, StartLocalPreviewParams } from '../model'
import type { LocalMediaRepository } from '../repository/LocalMediaRepository'

export class StartLocalPreviewUseCase implements UseCase<
  StartLocalPreviewParams,
  PromiseResult<void, MediaError>
> {
  constructor(private readonly repository: LocalMediaRepository) {}

  execute(params: StartLocalPreviewParams): PromiseResult<void, MediaError> {
    return this.repository.startPreview(params)
  }
}
