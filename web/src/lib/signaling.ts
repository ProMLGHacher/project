import type { HeartbeatPayload, SignalEnvelope } from '@/features/protocol/types'
import { logError, logInfo, logWarn } from '@/lib/logger'

export type SignalingState = 'idle' | 'connecting' | 'open' | 'closed' | 'error'

export class SignalingClient {
  private socket: WebSocket | null = null
  private listeners = new Set<(message: SignalEnvelope) => void>()
  private stateListeners = new Set<(state: SignalingState) => void>()
  private state: SignalingState = 'idle'
  private heartbeatTimer: number | null = null
  private lastPongAt: number | null = null

  async connect(url: string) {
    this.setState('connecting')
    logInfo('signaling', 'connecting websocket', { url })
    await new Promise<void>((resolve, reject) => {
      const socket = new WebSocket(url)
      socket.addEventListener('open', () => {
        this.socket = socket
        this.setState('open')
        this.lastPongAt = Date.now()
        this.startHeartbeat()
        logInfo('signaling', 'websocket open', { url })
        resolve()
      })
      socket.addEventListener('message', (event) => {
        const message = JSON.parse(event.data as string) as SignalEnvelope
        if (message.type === 'heartbeat.pong') {
          const payload = (message.payload ?? {}) as HeartbeatPayload
          this.lastPongAt = payload.timestamp || Date.now()
          logInfo('signaling', 'heartbeat pong', { lastPongAt: this.lastPongAt })
          return
        }
        logInfo('signaling', 'received message', { type: message.type, payload: message.payload })
        this.listeners.forEach((listener) => listener(message))
      })
      socket.addEventListener('error', () => {
        this.setState('error')
        logError('signaling', 'websocket error', { url })
        reject(new Error('websocket connection failed'))
      })
      socket.addEventListener('close', () => {
        if (this.socket === socket) {
          this.socket = null
        }
        this.stopHeartbeat()
        this.setState('closed')
        logWarn('signaling', 'websocket closed', { url })
      })
    })
  }

  subscribe(listener: (message: SignalEnvelope) => void) {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  subscribeState(listener: (state: SignalingState) => void) {
    this.stateListeners.add(listener)
    listener(this.state)
    return () => this.stateListeners.delete(listener)
  }

  send<T>(message: SignalEnvelope<T>) {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      throw new Error('signaling socket is not connected')
    }
    logInfo('signaling', 'sending message', { type: message.type, payload: message.payload })
    this.socket.send(JSON.stringify(message))
  }

  close() {
    if (!this.socket) {
      this.stopHeartbeat()
      this.setState('closed')
      return
    }
    this.stopHeartbeat()
    this.socket.close()
    this.socket = null
  }

  private setState(state: SignalingState) {
    this.state = state
    this.stateListeners.forEach((listener) => listener(state))
  }

  private startHeartbeat() {
    this.stopHeartbeat()
    this.heartbeatTimer = window.setInterval(() => {
      if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
        return
      }

      const now = Date.now()
      if (this.lastPongAt && now - this.lastPongAt > 30000) {
        logWarn('signaling', 'heartbeat pong timeout', { lastPongAt: this.lastPongAt, now })
      }

      this.send<HeartbeatPayload>({
        type: 'heartbeat.ping',
        payload: {
          timestamp: now
        }
      })
    }, 10000)
  }

  private stopHeartbeat() {
    if (this.heartbeatTimer !== null) {
      window.clearInterval(this.heartbeatTimer)
      this.heartbeatTimer = null
    }
  }
}
