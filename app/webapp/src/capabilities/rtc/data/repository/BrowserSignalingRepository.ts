import { MutableSharedFlow, err, ok, type PromiseResult } from '@kvt/core'
import type { RtcError, SignalingMessage } from '@capabilities/rtc/domain/model'
import type { SignalingRepository } from '@capabilities/rtc/domain/repository/SignalingRepository'
import { SignalingClient } from '../infra/signaling'

export class BrowserSignalingRepository implements SignalingRepository {
  private readonly client = new SignalingClient()
  private readonly messageFlow = new MutableSharedFlow<SignalingMessage>()

  readonly messages = this.messageFlow.asSharedFlow()

  async connect(wsUrl: string): PromiseResult<void, RtcError> {
    try {
      await this.client.connect(wsUrl)
      this.client.subscribe((message) => {
        this.messageFlow.emit({
          type: message.type as SignalingMessage['type'],
          payload: message.payload
        })
      })
      return ok()
    } catch (error) {
      return err({ type: 'signaling-failed', message: readableError(error) })
    }
  }

  async send(message: SignalingMessage): PromiseResult<void, RtcError> {
    try {
      this.client.send(message)
      return ok()
    } catch (error) {
      return err({ type: 'signaling-failed', message: readableError(error) })
    }
  }

  disconnect(): void {
    this.client.close()
  }
}

function readableError(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
