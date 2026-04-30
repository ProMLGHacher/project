import type { PromiseResult, StateFlow } from '@kvt/core'
import type {
  ChatAttachment,
  ChatConnectParams,
  ChatError,
  ChatSendMessageParams,
  ChatState,
  ChatUploadAttachmentParams
} from '../model/Chat'

export interface ChatRepository {
  readonly state: StateFlow<ChatState>
  connect(params: ChatConnectParams): PromiseResult<void, ChatError>
  disconnect(): void
  sendMessage(params: ChatSendMessageParams): PromiseResult<void, ChatError>
  uploadAttachment(params: ChatUploadAttachmentParams): PromiseResult<ChatAttachment, ChatError>
  markRead(messageId: string): PromiseResult<void, ChatError>
  toggleReaction(messageId: string, emoji: string): PromiseResult<void, ChatError>
  editMessage(messageId: string, markdown: string): PromiseResult<void, ChatError>
  deleteMessage(messageId: string): PromiseResult<void, ChatError>
}
