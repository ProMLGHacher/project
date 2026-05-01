export type ChatConnectionStatus =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'closed'
  | 'failed'

export type ChatParticipant = {
  readonly id: string
  readonly displayName: string
  readonly role: string
}

export type ChatChannel = {
  readonly id: string
  readonly spaceId: string
  readonly title: string
  readonly kind: string
  readonly createdAt: string
}

export type ChatAttachment = {
  readonly id: string
  readonly fileName: string
  readonly contentType: string
  readonly sizeBytes: number
  readonly url: string
  readonly objectKey?: string
  readonly previewUrl?: string
  readonly posterUrl?: string
  readonly kind: 'image' | 'video' | 'file' | string
  readonly status: string
  readonly width?: number
  readonly height?: number
  readonly durationMs?: number
}

export type ChatLinkPreview = {
  readonly url: string
  readonly title?: string
  readonly description?: string
  readonly imageUrl?: string
  readonly siteName?: string
  readonly status: string
}

export type ChatMessage = {
  readonly id: string
  readonly channelId: string
  readonly author: ChatParticipant
  readonly bodyMarkdown: string
  readonly bodyPlain: string
  readonly mentions: readonly string[]
  readonly replyToId?: string
  readonly attachments: readonly ChatAttachment[]
  readonly linkPreviews: readonly ChatLinkPreview[]
  readonly reactions: Readonly<Record<string, readonly string[]>>
  readonly createdAt: string
  readonly editedAt?: string
  readonly deletedAt?: string
  readonly pending?: boolean
  readonly failed?: boolean
}

export type ChatReadCursor = {
  readonly channelId: string
  readonly participantId: string
  readonly lastReadMessageId: string
  readonly updatedAt: string
}

export type ChatState = {
  readonly status: ChatConnectionStatus
  readonly participant: ChatParticipant | null
  readonly spaceId: string | null
  readonly channels: readonly ChatChannel[]
  readonly messagesByChannel: Readonly<Record<string, readonly ChatMessage[]>>
  readonly readCursors: readonly ChatReadCursor[]
  readonly unreadByChannel: Readonly<Record<string, number>>
  readonly lastError: string | null
}

export type ChatClientConfig = {
  readonly fetchImpl?: typeof fetch
  readonly WebSocketImpl?: typeof WebSocket
}

export type ConnectParams = {
  readonly chatUrl: string
  readonly chatToken: string
}

export type SendMessageParams = {
  readonly channelId: string
  readonly markdown: string
  readonly replyToId?: string
  readonly attachments?: readonly ChatAttachment[]
}

export type CreateAttachmentUploadParams = {
  readonly fileName: string
  readonly contentType: string
  readonly sizeBytes: number
}

export type AttachmentUpload = {
  readonly attachment: ChatAttachment
  readonly uploadUrl: string
}

export type ChatEvent =
  | { readonly type: 'snapshot'; readonly state: ChatState }
  | { readonly type: 'message-created'; readonly message: ChatMessage }
  | { readonly type: 'message-edited'; readonly message: ChatMessage }
  | { readonly type: 'message-deleted'; readonly message: ChatMessage }
  | { readonly type: 'reaction-updated'; readonly message: ChatMessage }
  | { readonly type: 'read-updated'; readonly cursor: ChatReadCursor }
  | { readonly type: 'attachment-updated'; readonly attachment: ChatAttachment }
  | { readonly type: 'link-preview-updated'; readonly message: ChatMessage }

type Listener<T> = (value: T) => void
const heartbeatIntervalMs = 25_000

const initialState: ChatState = {
  status: 'idle',
  participant: null,
  spaceId: null,
  channels: [],
  messagesByChannel: {},
  readCursors: [],
  unreadByChannel: {},
  lastError: null
}

export function createKvatumChatClient(config: ChatClientConfig = {}) {
  return new KvatumChatClient(config)
}

export class KvatumChatClient {
  private readonly fetchImpl: typeof fetch
  private readonly WebSocketImpl: typeof WebSocket
  private readonly stateListeners = new Set<Listener<ChatState>>()
  private readonly eventListeners = new Set<Listener<ChatEvent>>()
  private readonly errorListeners = new Set<Listener<Error>>()
  private socket: WebSocket | null = null
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null
  private chatUrl = ''
  private chatToken = ''
  private state: ChatState = initialState

  constructor(config: ChatClientConfig = {}) {
    // Native browser fetch depends on Window as this-context in some runtimes.
    // SDK stores a bound function so app-layer calls never hit "Illegal invocation".
    this.fetchImpl = config.fetchImpl ?? globalThis.fetch.bind(globalThis)
    this.WebSocketImpl = config.WebSocketImpl ?? WebSocket
  }

  getState(): ChatState {
    return this.state
  }

  on(type: 'state', listener: Listener<ChatState>): () => void
  on(type: 'event', listener: Listener<ChatEvent>): () => void
  on(type: 'error', listener: Listener<Error>): () => void
  on(
    type: 'state' | 'event' | 'error',
    listener: Listener<ChatState> | Listener<ChatEvent> | Listener<Error>
  ): () => void {
    const listeners =
      type === 'state'
        ? this.stateListeners
        : type === 'event'
          ? this.eventListeners
          : this.errorListeners
    listeners.add(listener as never)
    return () => listeners.delete(listener as never)
  }

  async connect(params: ConnectParams): Promise<void> {
    this.disconnect()
    this.chatUrl = params.chatUrl.replace(/\/$/, '')
    this.chatToken = params.chatToken
    this.setState({ ...this.state, status: 'connecting', lastError: null })

    const socket = new this.WebSocketImpl(resolveWsUrl(this.chatUrl, this.chatToken))
    this.socket = socket
    socket.addEventListener('open', () => {
      this.setState({ ...this.state, status: 'connected' })
      this.startHeartbeat(socket)
    })
    socket.addEventListener('message', (event) => {
      this.handleEnvelope(JSON.parse(String(event.data)) as SignalEnvelope)
    })
    socket.addEventListener('close', () => {
      if (this.socket === socket) {
        this.stopHeartbeat()
        this.setState({ ...this.state, status: 'closed' })
      }
    })
    socket.addEventListener('error', () => {
      this.captureError(new Error('Chat socket failed'))
    })
  }

  disconnect(): void {
    this.stopHeartbeat()
    this.socket?.close()
    this.socket = null
    this.setState({ ...this.state, status: 'closed' })
  }

  async loadMessages({
    channelId,
    before,
    after,
    limit = 50
  }: {
    readonly channelId: string
    readonly before?: string
    readonly after?: string
    readonly limit?: number
  }): Promise<readonly ChatMessage[]> {
    const query = new URLSearchParams({ limit: String(limit) })
    if (before) query.set('before', before)
    if (after) query.set('after', after)
    const response = await this.request<{ readonly messages: readonly ChatMessage[] }>(
      `/v1/channels/${encodeURIComponent(channelId)}/messages?${query.toString()}`
    )
    this.mergeMessages(channelId, response.messages)
    return response.messages
  }

  async sendMessage(params: SendMessageParams): Promise<ChatMessage> {
    const optimisticId = `pending_${Date.now()}_${Math.random().toString(16).slice(2)}`
    const optimistic: ChatMessage | null = this.state.participant
      ? {
          id: optimisticId,
          channelId: params.channelId,
          author: this.state.participant,
          bodyMarkdown: params.markdown,
          bodyPlain: params.markdown,
          mentions: [],
          replyToId: params.replyToId,
          attachments: params.attachments ?? [],
          linkPreviews: [],
          reactions: {},
          createdAt: new Date().toISOString(),
          pending: true
        }
      : null
    if (optimistic) this.upsertMessage(optimistic)
    const message = await this.request<ChatMessage>(
      `/v1/channels/${encodeURIComponent(params.channelId)}/messages`,
      {
        method: 'POST',
        headers: { 'Idempotency-Key': createIdempotencyKey() },
        body: JSON.stringify(params)
      }
    )
    if (optimistic) this.removeMessage(params.channelId, optimisticId)
    this.upsertMessage(message)
    return message
  }

  async editMessage(messageId: string, markdown: string): Promise<ChatMessage> {
    const message = await this.request<ChatMessage>(
      `/v1/messages/${encodeURIComponent(messageId)}`,
      {
        method: 'PATCH',
        headers: { 'Idempotency-Key': createIdempotencyKey() },
        body: JSON.stringify({ markdown })
      }
    )
    this.upsertMessage(message)
    return message
  }

  async deleteMessage(messageId: string): Promise<ChatMessage> {
    const message = await this.request<ChatMessage>(
      `/v1/messages/${encodeURIComponent(messageId)}`,
      {
        method: 'DELETE',
        headers: { 'Idempotency-Key': createIdempotencyKey() }
      }
    )
    this.upsertMessage(message)
    return message
  }

  async toggleReaction(messageId: string, emoji: string): Promise<ChatMessage> {
    const message = await this.request<ChatMessage>(
      `/v1/messages/${encodeURIComponent(messageId)}/reactions/${encodeURIComponent(emoji)}`,
      {
        method: 'PUT',
        headers: { 'Idempotency-Key': createIdempotencyKey() }
      }
    )
    this.upsertMessage(message)
    return message
  }

  async markRead(channelId: string, messageId: string): Promise<ChatReadCursor> {
    const cursor = await this.request<ChatReadCursor>(
      `/v1/channels/${encodeURIComponent(channelId)}/read-cursor`,
      {
        method: 'POST',
        headers: { 'Idempotency-Key': createIdempotencyKey() },
        body: JSON.stringify({ lastReadMessageId: messageId })
      }
    )
    this.applyReadCursor(cursor)
    return cursor
  }

  async createAttachmentUpload(params: CreateAttachmentUploadParams): Promise<AttachmentUpload> {
    return this.request<AttachmentUpload>('/v1/attachments/uploads', {
      method: 'POST',
      headers: { 'Idempotency-Key': createIdempotencyKey() },
      body: JSON.stringify(params)
    })
  }

  async completeAttachmentUpload(attachmentId: string): Promise<ChatAttachment> {
    return this.request<ChatAttachment>(
      `/v1/attachments/${encodeURIComponent(attachmentId)}/complete`,
      {
        method: 'POST',
        headers: { 'Idempotency-Key': createIdempotencyKey() }
      }
    )
  }

  async uploadAttachment(file: File): Promise<ChatAttachment> {
    const upload = await this.createAttachmentUpload({
      fileName: file.name,
      contentType: file.type || 'application/octet-stream',
      sizeBytes: file.size
    })
    const response = await this.fetchImpl(upload.uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': file.type || 'application/octet-stream'
      },
      body: file
    })
    if (!response.ok) {
      throw new Error(`Attachment upload failed: ${response.status}`)
    }
    return this.completeAttachmentUpload(upload.attachment.id)
  }

  renderMarkdown(markdown: string): string {
    return renderMarkdown(markdown)
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const response = await this.fetchImpl(`${this.chatUrl}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.chatToken}`,
        ...init.headers
      }
    })
    if (!response.ok) {
      throw new Error(`Chat request failed: ${response.status}`)
    }
    return (await response.json()) as T
  }

  private handleEnvelope(envelope: SignalEnvelope): void {
    switch (envelope.type) {
      case 'chat.snapshot': {
        const snapshot = envelope.payload as SnapshotPayload
        const messagesByChannel: Record<string, readonly ChatMessage[]> = {
          ...this.state.messagesByChannel
        }
        for (const message of snapshot.messages) {
          messagesByChannel[message.channelId] = mergeMessageList(
            messagesByChannel[message.channelId] ?? [],
            [message]
          )
        }
        this.setState({
          ...this.state,
          status: 'connected',
          participant: snapshot.participant,
          spaceId: snapshot.spaceId,
          channels: snapshot.channels,
          messagesByChannel,
          readCursors: snapshot.readCursors,
          unreadByChannel: snapshot.unreadByChannel
        })
        this.emitEvent({ type: 'snapshot', state: this.state })
        break
      }
      case 'chat.message.created':
        this.applyMessageEvent('message-created', envelope.payload as ChatMessage)
        break
      case 'chat.message.edited':
        this.applyMessageEvent('message-edited', envelope.payload as ChatMessage)
        break
      case 'chat.message.deleted':
        this.applyMessageEvent('message-deleted', envelope.payload as ChatMessage)
        break
      case 'chat.reaction.updated':
        this.applyMessageEvent('reaction-updated', envelope.payload as ChatMessage)
        break
      case 'chat.read.updated': {
        const cursor = envelope.payload as ChatReadCursor
        this.applyReadCursor(cursor)
        this.emitEvent({ type: 'read-updated', cursor })
        break
      }
      case 'chat.attachment.uploaded':
      case 'chat.attachment.processed': {
        const attachment = envelope.payload as ChatAttachment
        this.emitEvent({ type: 'attachment-updated', attachment })
        break
      }
      case 'chat.link.preview.updated': {
        this.applyMessageEvent('link-preview-updated', envelope.payload as ChatMessage)
        break
      }
      case 'heartbeat.pong':
        break
      case 'chat.error':
        this.captureError(
          new Error(String((envelope.payload as { message?: string }).message ?? 'Chat error'))
        )
        break
    }
  }

  private applyMessageEvent(
    type: Exclude<ChatEvent['type'], 'snapshot' | 'read-updated'>,
    message: ChatMessage
  ): void {
    this.upsertMessage(message)
    this.emitEvent({ type, message } as ChatEvent)
  }

  private mergeMessages(channelId: string, messages: readonly ChatMessage[]): void {
    this.setState({
      ...this.state,
      messagesByChannel: {
        ...this.state.messagesByChannel,
        [channelId]: mergeMessageList(this.state.messagesByChannel[channelId] ?? [], messages)
      }
    })
  }

  private upsertMessage(message: ChatMessage): void {
    this.mergeMessages(message.channelId, [message])
  }

  private removeMessage(channelId: string, messageId: string): void {
    this.setState({
      ...this.state,
      messagesByChannel: {
        ...this.state.messagesByChannel,
        [channelId]: (this.state.messagesByChannel[channelId] ?? []).filter(
          (message) => message.id !== messageId
        )
      }
    })
  }

  private applyReadCursor(cursor: ChatReadCursor): void {
    this.setState({
      ...this.state,
      readCursors: [
        ...this.state.readCursors.filter(
          (item) =>
            item.channelId !== cursor.channelId || item.participantId !== cursor.participantId
        ),
        cursor
      ],
      unreadByChannel: { ...this.state.unreadByChannel, [cursor.channelId]: 0 }
    })
  }

  private captureError(error: Error): void {
    this.setState({ ...this.state, status: 'failed', lastError: error.message })
    this.errorListeners.forEach((listener) => listener(error))
  }

  private setState(state: ChatState): void {
    this.state = state
    this.stateListeners.forEach((listener) => listener(state))
  }

  private emitEvent(event: ChatEvent): void {
    this.eventListeners.forEach((listener) => listener(event))
  }

  private startHeartbeat(socket: WebSocket): void {
    this.stopHeartbeat()
    // Чат живет поверх обычного WS за proxy; ping держит idle-соединение открытым.
    this.heartbeatTimer = setInterval(() => {
      if (this.socket !== socket || socket.readyState !== this.WebSocketImpl.OPEN) {
        return
      }
      socket.send(JSON.stringify({ type: 'heartbeat.ping' }))
    }, heartbeatIntervalMs)
  }

  private stopHeartbeat(): void {
    if (!this.heartbeatTimer) {
      return
    }
    clearInterval(this.heartbeatTimer)
    this.heartbeatTimer = null
  }
}

type SignalEnvelope = {
  readonly type: string
  readonly payload?: unknown
}

type SnapshotPayload = {
  readonly spaceId: string
  readonly participant: ChatParticipant
  readonly channels: readonly ChatChannel[]
  readonly messages: readonly ChatMessage[]
  readonly readCursors: readonly ChatReadCursor[]
  readonly unreadByChannel: Readonly<Record<string, number>>
}

function compareMessages(left: ChatMessage, right: ChatMessage): number {
  return new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime()
}

function mergeMessageList(
  existing: readonly ChatMessage[],
  incoming: readonly ChatMessage[]
): readonly ChatMessage[] {
  const byId = new Map(existing.map((message) => [message.id, message]))
  incoming.forEach((message) => byId.set(message.id, message))
  return [...byId.values()].sort(compareMessages)
}

function resolveWsUrl(chatUrl: string, token: string): string {
  const base = new URL(chatUrl)
  const prefix = base.pathname.replace(/\/$/, '')
  const url = new URL(`${prefix}/v1/connect`, base)
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
  url.searchParams.set('token', token)
  return url.toString()
}

function createIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `idem_${Date.now()}_${Math.random().toString(16).slice(2)}`
}

export function renderMarkdown(markdown: string): string {
  const lines = escapeHtml(markdown).split('\n')
  const html: string[] = []
  let listOpen = false

  for (const line of lines) {
    const bullet = line.match(/^\s*[-*]\s+(.+)$/)
    if (bullet) {
      if (!listOpen) {
        html.push('<ul>')
        listOpen = true
      }
      html.push(`<li>${renderInlineMarkdown(bullet[1] ?? '')}</li>`)
      continue
    }
    if (listOpen) {
      html.push('</ul>')
      listOpen = false
    }
    if (!line.trim()) {
      html.push('<br />')
      continue
    }
    const heading = line.match(/^(#{1,3})\s+(.+)$/)
    if (heading) {
      const level = heading[1]?.length ?? 2
      html.push(`<h${level}>${renderInlineMarkdown(heading[2] ?? '')}</h${level}>`)
      continue
    }
    if (line.startsWith('&gt; ')) {
      html.push(`<blockquote>${renderInlineMarkdown(line.slice(5))}</blockquote>`)
      continue
    }
    html.push(`<p>${renderInlineMarkdown(line)}</p>`)
  }
  if (listOpen) {
    html.push('</ul>')
  }
  return html.join('')
}

function renderInlineMarkdown(value: string): string {
  return value
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/_([^_]+)_/g, '<em>$1</em>')
    .replace(
      /\[([^\]]+)]\((https?:\/\/[^)]+)\)/g,
      '<a href="$2" target="_blank" rel="noreferrer">$1</a>'
    )
    .replace(/(^|[\s(])(https?:\/\/[^\s<]+)/g, '$1<a href="$2" target="_blank" rel="noreferrer">$2</a>')
    .replace(/@([a-zA-Z0-9_.-]+)/g, '<span data-mention="$1">@$1</span>')
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}
