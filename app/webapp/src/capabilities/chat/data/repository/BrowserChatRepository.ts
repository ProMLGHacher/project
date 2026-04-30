import { MutableStateFlow, err, ok, type PromiseResult } from '@kvt/core'
import {
  createKvatumChatClient,
  type ChatAttachment,
  type ChatMessage,
  type KvatumChatClient
} from '@kvatum/chat-sdk'
import type {
  ChatConnectParams,
  ChatError,
  ChatSendMessageParams,
  ChatState
} from '@capabilities/chat/domain/model/Chat'
import type { ChatRepository } from '@capabilities/chat/domain/repository/ChatRepository'

const initialState: ChatState = {
  status: 'idle',
  participant: null,
  activeChannelId: null,
  channels: [],
  messages: [],
  readCursors: [],
  unreadCount: 0,
  lastError: null
}

export class BrowserChatRepository implements ChatRepository {
  private readonly mutableState = new MutableStateFlow<ChatState>(initialState)
  private readonly client: KvatumChatClient = createKvatumChatClient()
  private activeChannelId: string | null = null

  readonly state = this.mutableState.asStateFlow()

  constructor() {
    this.client.on('state', (state) => {
      const activeChannelId = this.activeChannelId ?? state.channels[0]?.id ?? null
      this.mutableState.set({
        status: state.status,
        participant: state.participant,
        activeChannelId,
        channels: state.channels,
        messages: activeChannelId ? (state.messagesByChannel[activeChannelId] ?? []) : [],
        readCursors: state.readCursors,
        unreadCount: activeChannelId ? (state.unreadByChannel[activeChannelId] ?? 0) : 0,
        lastError: state.lastError
      })
    })
  }

  async connect(params: ChatConnectParams): PromiseResult<void, ChatError> {
    try {
      this.activeChannelId = params.chatChannelId
      await this.client.connect({
        chatUrl: params.chatUrl,
        chatToken: params.chatToken
      })
      await this.client.loadMessages({ channelId: params.chatChannelId })
      return ok()
    } catch (error) {
      return err({ type: 'connection-failed', message: readableError(error) })
    }
  }

  disconnect(): void {
    this.client.disconnect()
    this.activeChannelId = null
    this.mutableState.set(initialState)
  }

  async sendMessage(params: ChatSendMessageParams): PromiseResult<void, ChatError> {
    const channelId = this.activeChannelId
    if (!channelId) {
      return err({ type: 'send-failed', message: 'Chat channel is not connected' })
    }
    try {
      await this.client.sendMessage({
        channelId,
        markdown: params.markdown,
        replyToId: params.replyToId ?? undefined,
        attachments: params.attachments
      })
      return ok()
    } catch (error) {
      return err({ type: 'send-failed', message: readableError(error) })
    }
  }

  async uploadAttachment(params: { readonly file: File }): PromiseResult<ChatAttachment, ChatError> {
    try {
      const attachment = await this.client.uploadAttachment(params.file)
      return ok(attachment)
    } catch (error) {
      return err({ type: 'unknown-error', message: readableError(error) })
    }
  }

  async markRead(messageId: string): PromiseResult<void, ChatError> {
    const channelId = this.activeChannelId
    if (!channelId || !messageId) {
      return ok()
    }
    try {
      await this.client.markRead(channelId, messageId)
      return ok()
    } catch (error) {
      return err({ type: 'unknown-error', message: readableError(error) })
    }
  }

  async toggleReaction(messageId: string, emoji: string): PromiseResult<void, ChatError> {
    try {
      await this.client.toggleReaction(messageId, emoji)
      return ok()
    } catch (error) {
      return err({ type: 'unknown-error', message: readableError(error) })
    }
  }

  async editMessage(messageId: string, markdown: string): PromiseResult<void, ChatError> {
    try {
      await this.client.editMessage(messageId, markdown)
      return ok()
    } catch (error) {
      return err({ type: 'unknown-error', message: readableError(error) })
    }
  }

  async deleteMessage(messageId: string): PromiseResult<void, ChatError> {
    try {
      await this.client.deleteMessage(messageId)
      return ok()
    } catch (error) {
      return err({ type: 'unknown-error', message: readableError(error) })
    }
  }
}

export function renderChatMarkdown(markdown: string): string {
  return createKvatumChatClient().renderMarkdown(markdown)
}

export function latestMessage(messages: readonly ChatMessage[]): ChatMessage | null {
  return messages[messages.length - 1] ?? null
}

function readableError(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
