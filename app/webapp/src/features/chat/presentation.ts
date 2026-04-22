import {
  MutableSharedFlow,
  MutableStateFlow,
  ViewModel,
  type SharedFlow,
  type StateFlow
} from '@kvt/core'
import {
  type ChatId,
  type ChatMessage,
  type ChatRepository,
  type ChatSnapshot,
  type ChatThread,
  type ChatUser,
  DeleteMessageUseCase,
  MarkChatReadUseCase,
  type MessageId,
  SendChatMessageUseCase,
  ToggleMessageReactionUseCase
} from './domain'

export interface ChatListItem {
  readonly id: ChatId
  readonly title: string
  readonly avatar: string
  readonly avatarColor: string
  readonly preview: string
  readonly lastMessageAt: string
  readonly lastMessageSort: number
  readonly pinned: boolean
  readonly unreadCount: number
  readonly read: boolean
  readonly selected: boolean
}

export interface ChatMessageItem {
  readonly id: MessageId
  readonly authorName: string
  readonly authorAvatar: string
  readonly authorColor: string
  readonly body: string
  readonly createdAt: string
  readonly mine: boolean
  readonly read: boolean
  readonly deleted: boolean
  readonly reactions: readonly ReactionItem[]
  readonly replies: readonly ChatMessageItem[]
  readonly replyTo?: {
    readonly authorName: string
    readonly body: string
  }
}

export interface ReactionItem {
  readonly emoji: string
  readonly count: number
  readonly reactedByMe: boolean
  readonly users: readonly string[]
}

export interface MessageInspectorState {
  readonly message: ChatMessageItem
  readonly readBy: readonly ChatUser[]
  readonly reactions: readonly ReactionItem[]
  readonly canDelete: boolean
}

export interface ChatUiState {
  readonly query: string
  readonly selectedChatId: ChatId | null
  readonly selectedMessageId: MessageId | null
  readonly listPaneWidth: number
  readonly inspectorPaneWidth: number
  readonly chats: readonly ChatListItem[]
  readonly activeChat: ChatListItem | null
  readonly messages: readonly ChatMessageItem[]
  readonly inspector: MessageInspectorState | null
  readonly participants: readonly ChatUser[]
  readonly replyTarget: ChatMessageItem | null
}

export type ChatEffect =
  | { readonly type: 'message-sent'; readonly text: string }
  | { readonly type: 'reaction-updated'; readonly text: string }
  | { readonly type: 'message-deleted'; readonly text: string }
  | { readonly type: 'reply-started'; readonly text: string }

interface LocalState {
  readonly query: string
  readonly selectedChatId: ChatId | null
  readonly selectedMessageId: MessageId | null
  readonly replyToMessageId: MessageId | null
  readonly listPaneWidth: number
  readonly inspectorPaneWidth: number
}

const initialLocalState: LocalState = {
  query: '',
  selectedChatId: null,
  selectedMessageId: null,
  replyToMessageId: null,
  listPaneWidth: 340,
  inspectorPaneWidth: 360
}

export class ChatViewModel extends ViewModel {
  private snapshot: ChatSnapshot
  private localState = initialLocalState
  private readonly mutableUiState: MutableStateFlow<ChatUiState>
  private readonly mutableEffects = new MutableSharedFlow<ChatEffect>()

  readonly uiState: StateFlow<ChatUiState>
  readonly effects: SharedFlow<ChatEffect> = this.mutableEffects.asSharedFlow()

  constructor(
    repository: ChatRepository,
    private readonly sendMessageUseCase: SendChatMessageUseCase,
    private readonly markChatReadUseCase: MarkChatReadUseCase,
    private readonly toggleReactionUseCase: ToggleMessageReactionUseCase,
    private readonly deleteMessageUseCase: DeleteMessageUseCase
  ) {
    super()
    this.snapshot = repository.snapshot.value
    this.localState = {
      ...this.localState,
      selectedChatId: selectInitialChatId(this.snapshot)
    }
    this.mutableUiState = new MutableStateFlow<ChatUiState>(this.buildUiState())
    this.uiState = this.mutableUiState.asStateFlow()

    this.addDisposable(
      repository.snapshot.subscribe((snapshot) => {
        this.snapshot = snapshot
        this.ensureSelection()
        this.commit()
      })
    )
  }

  protected onInit() {
    const selectedChatId = this.localState.selectedChatId
    if (selectedChatId) {
      this.markChatReadUseCase.execute(selectedChatId)
    }
  }

  setQuery(query: string): void {
    this.localState = {
      ...this.localState,
      query
    }
    this.ensureSelection()
    this.commit()
  }

  selectChat(chatId: ChatId): void {
    this.localState = {
      ...this.localState,
      selectedChatId: chatId,
      selectedMessageId: null,
      replyToMessageId: null
    }
    this.markChatReadUseCase.execute(chatId)
    this.commit()
  }

  selectMessage(messageId: MessageId): void {
    this.localState = {
      ...this.localState,
      selectedMessageId: messageId
    }
    this.commit()
  }

  closeInspector(): void {
    this.localState = {
      ...this.localState,
      selectedMessageId: null
    }
    this.commit()
  }

  startReply(messageId: MessageId): void {
    this.localState = {
      ...this.localState,
      replyToMessageId: messageId,
      selectedMessageId: messageId
    }
    this.mutableEffects.emit({ type: 'reply-started', text: 'Reply mode enabled' })
    this.commit()
  }

  cancelReply(): void {
    this.localState = {
      ...this.localState,
      replyToMessageId: null
    }
    this.commit()
  }

  sendMessage(body: string): void {
    const selectedChatId = this.localState.selectedChatId
    if (!selectedChatId) return

    this.sendMessageUseCase.execute({
      chatId: selectedChatId,
      body,
      replyToId: this.localState.replyToMessageId ?? undefined
    })
    this.localState = {
      ...this.localState,
      replyToMessageId: null
    }
    this.mutableEffects.emit({ type: 'message-sent', text: 'Message sent' })
    this.commit()
  }

  toggleReaction(messageId: MessageId, emoji: string): void {
    this.toggleReactionUseCase.execute({ messageId, emoji })
    this.mutableEffects.emit({ type: 'reaction-updated', text: `Reaction ${emoji} updated` })
  }

  deleteMessage(messageId: MessageId): void {
    this.deleteMessageUseCase.execute(messageId)
    this.mutableEffects.emit({ type: 'message-deleted', text: 'Message deleted' })
  }

  setListPaneWidth(width: number): void {
    this.localState = {
      ...this.localState,
      listPaneWidth: clamp(width, 260, 520)
    }
    this.commit()
  }

  setInspectorPaneWidth(width: number): void {
    this.localState = {
      ...this.localState,
      inspectorPaneWidth: clamp(width, 300, 560)
    }
    this.commit()
  }

  getReplyTarget(): ChatMessageItem | null {
    if (!this.localState.replyToMessageId) return null
    return (
      this.buildMessageItems().find((message) => message.id === this.localState.replyToMessageId) ??
      null
    )
  }

  private ensureSelection(): void {
    const chatIds = this.buildChatListItems().map((chat) => chat.id)
    if (this.localState.selectedChatId && chatIds.includes(this.localState.selectedChatId)) {
      return
    }
    this.localState = {
      ...this.localState,
      selectedChatId: chatIds[0] ?? null,
      selectedMessageId: null
    }
  }

  private commit(): void {
    this.mutableUiState.set(this.buildUiState())
  }

  private buildUiState(): ChatUiState {
    const chats = this.buildChatListItems()
    const activeChat = chats.find((chat) => chat.id === this.localState.selectedChatId) ?? null
    const messages = this.buildMessageItems()
    const inspectorMessage =
      messages.find((message) => message.id === this.localState.selectedMessageId) ?? null

    return {
      query: this.localState.query,
      selectedChatId: this.localState.selectedChatId,
      selectedMessageId: this.localState.selectedMessageId,
      listPaneWidth: this.localState.listPaneWidth,
      inspectorPaneWidth: this.localState.inspectorPaneWidth,
      chats,
      activeChat,
      messages,
      inspector: inspectorMessage ? this.buildInspector(inspectorMessage) : null,
      participants: activeChat ? this.getParticipants(activeChat.id) : [],
      replyTarget:
        messages.find((message) => message.id === this.localState.replyToMessageId) ?? null
    }
  }

  private buildChatListItems(): readonly ChatListItem[] {
    const query = normalizeSearch(this.localState.query)

    return this.snapshot.chats
      .map((chat) => this.mapChat(chat))
      .filter((chat) => {
        if (!query) return true
        const messages = this.snapshot.messages.filter((message) => message.chatId === chat.id)
        const searchable = [chat.title, chat.preview, ...messages.map((message) => message.body)]
          .join(' ')
          .toLowerCase()
        return searchable.includes(query)
      })
      .sort((left, right) => {
        if (left.pinned !== right.pinned) return left.pinned ? -1 : 1
        return right.lastMessageSort - left.lastMessageSort
      })
  }

  private mapChat(chat: ChatThread): ChatListItem {
    const lastMessage = this.snapshot.messages
      .filter((message) => message.chatId === chat.id)
      .toSorted((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))[0]
    const unreadCount = this.snapshot.messages.filter(
      (message) =>
        message.chatId === chat.id &&
        message.authorId !== this.snapshot.currentUserId &&
        !message.readBy.includes(this.snapshot.currentUserId)
    ).length
    const avatarUser = this.getAvatarUser(chat)

    return {
      id: chat.id,
      title: chat.title,
      avatar: avatarUser.initials,
      avatarColor: avatarUser.color,
      preview: lastMessage ? getPreview(lastMessage) : 'No messages yet',
      lastMessageAt: lastMessage ? formatMessageDate(lastMessage.createdAt) : '',
      lastMessageSort: lastMessage ? Date.parse(lastMessage.createdAt) : 0,
      pinned: chat.pinned,
      unreadCount,
      read: unreadCount === 0,
      selected: chat.id === this.localState.selectedChatId
    }
  }

  private buildMessageItems(): readonly ChatMessageItem[] {
    const selectedChatId = this.localState.selectedChatId
    if (!selectedChatId) return []

    const messages = this.snapshot.messages
      .filter((message) => message.chatId === selectedChatId && !message.replyToId)
      .toSorted((left, right) => Date.parse(left.createdAt) - Date.parse(right.createdAt))

    return messages.map((message) => this.mapMessage(message))
  }

  private mapMessage(message: ChatMessage): ChatMessageItem {
    const author = this.getUser(message.authorId)
    const replies = this.snapshot.messages
      .filter((reply) => reply.replyToId === message.id)
      .toSorted((left, right) => Date.parse(left.createdAt) - Date.parse(right.createdAt))
      .map((reply) => this.mapMessage(reply))
    const replyTo = message.replyToId
      ? this.snapshot.messages.find((candidate) => candidate.id === message.replyToId)
      : undefined

    return {
      id: message.id,
      authorName: author.name,
      authorAvatar: author.initials,
      authorColor: author.color,
      body: message.body,
      createdAt: formatMessageDate(message.createdAt),
      mine: message.authorId === this.snapshot.currentUserId,
      read: message.readBy.length >= this.getParticipants(message.chatId).length,
      deleted: Boolean(message.deleted),
      reactions: this.mapReactions(message),
      replies,
      replyTo: replyTo
        ? {
            authorName: this.getUser(replyTo.authorId).name,
            body: getPreview(replyTo)
          }
        : undefined
    }
  }

  private buildInspector(message: ChatMessageItem): MessageInspectorState {
    const sourceMessage = this.snapshot.messages.find((candidate) => candidate.id === message.id)
    const readBy = sourceMessage ? sourceMessage.readBy.map((userId) => this.getUser(userId)) : []
    return {
      message,
      readBy,
      reactions: message.reactions,
      canDelete: message.mine && !message.deleted
    }
  }

  private mapReactions(message: ChatMessage): readonly ReactionItem[] {
    return Object.entries(message.reactions).map(([emoji, userIds]) => ({
      emoji,
      count: userIds.length,
      reactedByMe: userIds.includes(this.snapshot.currentUserId),
      users: userIds.map((userId) => this.getUser(userId).name)
    }))
  }

  private getParticipants(chatId: ChatId): readonly ChatUser[] {
    const chat = this.snapshot.chats.find((candidate) => candidate.id === chatId)
    return chat ? chat.participantIds.map((userId) => this.getUser(userId)) : []
  }

  private getAvatarUser(chat: ChatThread): ChatUser {
    if (chat.kind === 'group') {
      return this.getUser('u-ops')
    }
    return this.getUser(
      chat.participantIds.find((userId) => userId !== this.snapshot.currentUserId) ??
        this.snapshot.currentUserId
    )
  }

  private getUser(userId: string): ChatUser {
    return (
      this.snapshot.users.find((user) => user.id === userId) ?? {
        id: userId,
        name: 'Unknown',
        initials: '??',
        color: 'bg-muted text-muted-foreground'
      }
    )
  }
}

function selectInitialChatId(snapshot: ChatSnapshot): ChatId | null {
  return snapshot.chats[0]?.id ?? null
}

function normalizeSearch(query: string): string {
  return query.trim().toLowerCase()
}

function getPreview(message: ChatMessage): string {
  return message.deleted ? 'This message was deleted.' : message.body.replace(/[*_`>#-]/g, '')
}

function formatMessageDate(value: string): string {
  const date = new Date(value)
  const now = new Date()
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()

  return sameDay
    ? new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' }).format(date)
    : new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(date)
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}
