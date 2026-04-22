import { createToken, type StateFlow, type UseCase } from '@kvt/core'

export type ChatId = string
export type MessageId = string
export type UserId = string

export interface ChatUser {
  readonly id: UserId
  readonly name: string
  readonly initials: string
  readonly color: string
}

export interface ChatThread {
  readonly id: ChatId
  readonly title: string
  readonly kind: 'direct' | 'group'
  readonly participantIds: readonly UserId[]
  readonly pinned: boolean
}

export interface ChatMessage {
  readonly id: MessageId
  readonly chatId: ChatId
  readonly authorId: UserId
  readonly body: string
  readonly createdAt: string
  readonly readBy: readonly UserId[]
  readonly reactions: Readonly<Record<string, readonly UserId[]>>
  readonly replyToId?: MessageId
  readonly deleted?: boolean
}

export interface ChatSnapshot {
  readonly currentUserId: UserId
  readonly users: readonly ChatUser[]
  readonly chats: readonly ChatThread[]
  readonly messages: readonly ChatMessage[]
}

export interface SendMessageInput {
  readonly chatId: ChatId
  readonly body: string
  readonly replyToId?: MessageId
}

export interface ToggleReactionInput {
  readonly messageId: MessageId
  readonly emoji: string
}

export interface ChatRepository {
  readonly snapshot: StateFlow<ChatSnapshot>
  sendMessage(input: SendMessageInput): ChatMessage
  markChatRead(chatId: ChatId): void
  toggleReaction(input: ToggleReactionInput): void
  deleteMessage(messageId: MessageId): void
}

export const chatRepositoryToken = createToken<ChatRepository>('ChatRepository')

export class SendChatMessageUseCase implements UseCase<SendMessageInput, ChatMessage> {
  constructor(private readonly repository: ChatRepository) {}

  execute(input: SendMessageInput): ChatMessage {
    return this.repository.sendMessage(input)
  }
}

export class MarkChatReadUseCase implements UseCase<ChatId, void> {
  constructor(private readonly repository: ChatRepository) {}

  execute(chatId: ChatId): void {
    this.repository.markChatRead(chatId)
  }
}

export class ToggleMessageReactionUseCase implements UseCase<ToggleReactionInput, void> {
  constructor(private readonly repository: ChatRepository) {}

  execute(input: ToggleReactionInput): void {
    this.repository.toggleReaction(input)
  }
}

export class DeleteMessageUseCase implements UseCase<MessageId, void> {
  constructor(private readonly repository: ChatRepository) {}

  execute(messageId: MessageId): void {
    this.repository.deleteMessage(messageId)
  }
}
