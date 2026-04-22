import type { UseCase } from '@kvt/core'
import type { UserSettingsRepository } from '../repository/UserSettingsRepository'

export class SaveDefaultCameraEnabledUseCase implements UseCase<boolean, void> {
  constructor(private readonly userSettingsRepository: UserSettingsRepository) {}

  execute(enabled: boolean): void {
    this.userSettingsRepository.saveDefaultCameraEnabled(enabled)
  }
}
