import { createToken } from '@kvt/core'
import type { VoiceActivityRepository } from './VoiceActivityRepository'

export const voiceActivityRepositoryToken =
  createToken<VoiceActivityRepository>('VoiceActivityRepository')
