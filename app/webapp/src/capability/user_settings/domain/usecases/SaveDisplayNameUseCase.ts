import type { UseCase } from '@kvt/core'
import type { UserSettingsRepository } from '../repository/UserSettingsRepository'

export class SaveDisplayNameUseCase implements UseCase<string, void> {
  constructor(private readonly userSettingsRepository: UserSettingsRepository) {}

  execute(displayName: string): void {
    this.userSettingsRepository.saveDisplayName(displayName)
  }
}
