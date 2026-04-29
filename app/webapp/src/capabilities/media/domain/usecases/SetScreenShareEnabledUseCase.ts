import type { PromiseResult, UseCase } from '@kvt/core'
import type { MediaError } from '../model'
import type { ScreenShareRepository } from '../repository/ScreenShareRepository'

export class SetScreenShareEnabledUseCase implements UseCase<
  boolean,
  PromiseResult<void, MediaError>
> {
  constructor(private readonly repository: ScreenShareRepository) {}

  execute(enabled: boolean): PromiseResult<void, MediaError> {
    return this.repository.setScreenShareEnabled(enabled)
  }
}
