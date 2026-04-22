import type { UseCase } from '@kvt/core'
import type { UserSettingsRepository } from '../repository/UserSettingsRepository'

export class SavePreferredCameraUseCase implements UseCase<string | null, void> {
  constructor(private readonly userSettingsRepository: UserSettingsRepository) {}

  execute(deviceId: string | null): void {
    this.userSettingsRepository.savePreferredMicrophoneId(deviceId)
  }
}
