import type { SignalEnvelope } from '@/features/protocol/types'

export class SignalingClient {
  private socket: WebSocket | null = null
  private listeners = new Set<(message: SignalEnvelope) => void>()

  async connect(url: string) {
    await new Promise<void>((resolve, reject) => {
      const socket = new WebSocket(url)
      socket.addEventListener('open', () => {
        this.socket = socket
        resolve()
      })
      socket.addEventListener('message', (event) => {
        const message = JSON.parse(event.data as string) as SignalEnvelope
        this.listeners.forEach((listener) => listener(message))
      })
      socket.addEventListener('error', () => reject(new Error('websocket connection failed')))
    })
  }

  subscribe(listener: (message: SignalEnvelope) => void) {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  send<T>(message: SignalEnvelope<T>) {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      throw new Error('signaling socket is not connected')
    }
    this.socket.send(JSON.stringify(message))
  }

  close() {
    this.socket?.close()
    this.socket = null
  }
}
