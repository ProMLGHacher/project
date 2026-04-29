import type { PromiseResult } from '@kvt/core'
import type { MediaError } from '../model'

export interface ScreenShareRepository {
  setScreenShareEnabled(enabled: boolean): PromiseResult<void, MediaError>
}
