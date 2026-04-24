import { err, ok, type PromiseResult } from '@kvt/core'
import type {
  ClipboardWriteError,
  ClipboardWriteParams
} from '@capabilities/clipboard/domain/model/Clipboard'
import type { ClipboardRepository } from '@capabilities/clipboard/domain/repository/ClipboardRepository'

export class BrowserClipboardRepository implements ClipboardRepository {
  async writeText(params: ClipboardWriteParams): PromiseResult<void, ClipboardWriteError> {
    if (!navigator.clipboard) {
      return err({ type: 'clipboard-unavailable' })
    }

    try {
      await navigator.clipboard.writeText(params.text)
      return ok()
    } catch (error) {
      return err({
        type: 'unknown-error',
        message: error instanceof Error ? error.message : 'Clipboard write failed'
      })
    }
  }
}
