import type { UseCase } from '@kvt/core'

import type { UserSettingsRepository } from '../repository/UserSettingsRepository'
import type { UserSettings } from '../model/UserSettings'

export class GetUserPreferencesUseCase implements UseCase<void, Promise<UserSettings>> {
  constructor(private readonly userSettingsRepository: UserSettingsRepository) {}

  execute(): Promise<UserSettings> {
    return this.userSettingsRepository.getPreferences()
  }
}
