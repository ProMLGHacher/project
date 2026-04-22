import { MutableStateFlow } from '@kvt/core'
import {
  type ChatId,
  type ChatMessage,
  type ChatRepository,
  type ChatSnapshot,
  type MessageId,
  type SendMessageInput,
  type ToggleReactionInput,
  type UserId
} from './domain'

const currentUserId = 'u-me'

const initialSnapshot: ChatSnapshot = {
  currentUserId,
  users: [
    {
      id: currentUserId,
      name: 'Araik',
      initials: 'AR',
      color: 'bg-primary text-primary-foreground'
    },
    { id: 'u-lina', name: 'Lina Moroz', initials: 'LM', color: 'bg-info text-on-feedback' },
    { id: 'u-sam', name: 'Sam Carter', initials: 'SC', color: 'bg-success text-on-feedback' },
    { id: 'u-maya', name: 'Maya Chen', initials: 'MC', color: 'bg-warning text-slate-950' },
    { id: 'u-ops', name: 'Ops group', initials: 'OP', color: 'bg-accent text-accent-foreground' }
  ],
  chats: [
    {
      id: 'product-room',
      title: 'Product room',
      kind: 'group',
      participantIds: [currentUserId, 'u-lina', 'u-sam', 'u-maya'],
      pinned: true
    },
    {
      id: 'lina',
      title: 'Lina Moroz',
      kind: 'direct',
      participantIds: [currentUserId, 'u-lina'],
      pinned: true
    },
    {
      id: 'release-ops',
      title: 'Release ops',
      kind: 'group',
      participantIds: [currentUserId, 'u-sam', 'u-ops'],
      pinned: false
    },
    {
      id: 'maya',
      title: 'Maya Chen',
      kind: 'direct',
      participantIds: [currentUserId, 'u-maya'],
      pinned: false
    }
  ],
  messages: [
    createMessage(
      'm-1',
      'product-room',
      'u-lina',
      'Morning! I left a **markdown** summary in the spec.',
      -112
    ),
    createMessage(
      'm-2',
      'product-room',
      currentUserId,
      'Nice. Can we keep the mobile layout _pane-first_?',
      -96,
      ['u-lina', 'u-sam']
    ),
    createMessage(
      'm-3',
      'product-room',
      'u-sam',
      'Yes. List/detail on tablet, three panes on desktop.',
      -72,
      [currentUserId, 'u-lina']
    ),
    createMessage(
      'm-4',
      'product-room',
      'u-maya',
      '`Resizable` panes feel important for power users.',
      -28,
      [currentUserId],
      {
        '👍': [currentUserId, 'u-sam'],
        '🔥': ['u-lina']
      }
    ),
    createMessage(
      'm-5',
      'product-room',
      currentUserId,
      'Agreed. I will wire it through ViewModel intents.',
      -8,
      ['u-lina', 'u-sam', 'u-maya'],
      {},
      'm-4'
    ),
    createMessage('m-6', 'lina', 'u-lina', 'Can you review the onboarding copy today?', -66, [
      currentUserId
    ]),
    createMessage(
      'm-7',
      'lina',
      currentUserId,
      'Yes, send me the latest version and I will mark comments inline.',
      -52,
      ['u-lina']
    ),
    createMessage(
      'm-8',
      'release-ops',
      'u-sam',
      'Staging deploy finished. No regressions in the smoke run.',
      -44,
      [currentUserId, 'u-ops']
    ),
    createMessage(
      'm-9',
      'release-ops',
      'u-ops',
      'Keeping an eye on CPU pressure after video changes.',
      -35,
      [currentUserId]
    ),
    createMessage('m-10', 'maya', 'u-maya', 'The empty state animation is much better now.', -16, [
      currentUserId
    ])
  ]
}

export class InMemoryChatRepository implements ChatRepository {
  private readonly mutableSnapshot = new MutableStateFlow<ChatSnapshot>(initialSnapshot)
  readonly snapshot = this.mutableSnapshot.asStateFlow()

  sendMessage(input: SendMessageInput): ChatMessage {
    const body = input.body.trim()
    if (!body) {
      throw new Error('Message is empty')
    }

    const message: ChatMessage = {
      id: createId('m'),
      chatId: input.chatId,
      authorId: currentUserId,
      body,
      createdAt: new Date().toISOString(),
      readBy: [currentUserId],
      reactions: {},
      replyToId: input.replyToId
    }

    this.update((snapshot) => ({
      ...snapshot,
      messages: [...snapshot.messages, message]
    }))

    return message
  }

  markChatRead(chatId: ChatId): void {
    this.update((snapshot) => ({
      ...snapshot,
      messages: snapshot.messages.map((message) => {
        if (message.chatId !== chatId || message.readBy.includes(currentUserId)) {
          return message
        }
        return {
          ...message,
          readBy: [...message.readBy, currentUserId]
        }
      })
    }))
  }

  toggleReaction({ messageId, emoji }: ToggleReactionInput): void {
    this.update((snapshot) => ({
      ...snapshot,
      messages: snapshot.messages.map((message) => {
        if (message.id !== messageId) return message
        const existingUsers = message.reactions[emoji] ?? []
        const nextUsers = existingUsers.includes(currentUserId)
          ? existingUsers.filter((userId) => userId !== currentUserId)
          : [...existingUsers, currentUserId]
        const reactions = { ...message.reactions, [emoji]: nextUsers }
        if (nextUsers.length === 0) {
          delete reactions[emoji]
        }
        return { ...message, reactions }
      })
    }))
  }

  deleteMessage(messageId: MessageId): void {
    this.update((snapshot) => ({
      ...snapshot,
      messages: snapshot.messages.map((message) =>
        message.id === messageId && message.authorId === currentUserId
          ? { ...message, body: 'This message was deleted.', deleted: true, reactions: {} }
          : message
      )
    }))
  }

  private update(reducer: (snapshot: ChatSnapshot) => ChatSnapshot) {
    this.mutableSnapshot.set(reducer(this.mutableSnapshot.value))
  }
}

function createMessage(
  id: MessageId,
  chatId: ChatId,
  authorId: UserId,
  body: string,
  minutesFromNow: number,
  readBy: readonly UserId[] = [],
  reactions: Readonly<Record<string, readonly UserId[]>> = {},
  replyToId?: MessageId
): ChatMessage {
  return {
    id,
    chatId,
    authorId,
    body,
    createdAt: new Date(Date.now() + minutesFromNow * 60_000).toISOString(),
    readBy,
    reactions,
    replyToId
  }
}

function createId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}
