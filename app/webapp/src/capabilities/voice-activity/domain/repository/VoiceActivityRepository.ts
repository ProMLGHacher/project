import type { StateFlow } from '@kvt/core'
import type { VoiceActivitySource } from '../model/VoiceActivitySource'

export interface VoiceActivityRepository {
  readonly speakingParticipantIds: StateFlow<readonly string[]>

  observeSources(sources: readonly VoiceActivitySource[]): void
  stop(): void
}
