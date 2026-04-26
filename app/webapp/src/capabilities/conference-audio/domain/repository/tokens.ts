import { createToken } from '@kvt/core'
import type { ConferenceAudioRepository } from './ConferenceAudioRepository'

export const conferenceAudioRepositoryToken =
  createToken<ConferenceAudioRepository>('ConferenceAudioRepository')

