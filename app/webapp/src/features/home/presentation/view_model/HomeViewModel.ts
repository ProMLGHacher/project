import { CompositeDisposable, MutableSharedFlow, MutableStateFlow, ViewModel } from '@kvt/core'
import {
  initialHomeState,
  type HomeUiAction,
  type HomeUiEffect,
  type HomeUiState,
  type HomeErrorMessageKey
} from '../model/HomeState'
import type { CreateRoomFlowUseCase } from '@features/home/domain/usecases/CreateRoomFlowUseCase'
import type { GetRecentRoomsUseCase } from '@features/home/domain/usecases/GetRecentRoomsUseCase'
import type { JoinRoomFlowUseCase } from '@features/home/domain/usecases/JoinRoomFlowUseCase'
import type { SaveRecentRoomVisitUseCase } from '@features/home/domain/usecases/SaveRecentRoomVisitUseCase'
import type { ConnectChatUseCase } from '@capabilities/chat/domain/usecases/ConnectChatUseCase'
import type { DisconnectChatUseCase } from '@capabilities/chat/domain/usecases/DisconnectChatUseCase'
import type { MarkChatReadUseCase } from '@capabilities/chat/domain/usecases/MarkChatReadUseCase'
import type { ObserveChatUseCase } from '@capabilities/chat/domain/usecases/ObserveChatUseCase'
import type { SendChatMessageUseCase } from '@capabilities/chat/domain/usecases/SendChatMessageUseCase'
import type { ToggleChatReactionUseCase } from '@capabilities/chat/domain/usecases/ToggleChatReactionUseCase'
import type { EditChatMessageUseCase } from '@capabilities/chat/domain/usecases/EditChatMessageUseCase'
import type { DeleteChatMessageUseCase } from '@capabilities/chat/domain/usecases/DeleteChatMessageUseCase'
import type { UploadChatAttachmentUseCase } from '@capabilities/chat/domain/usecases/UploadChatAttachmentUseCase'
import type { GetUserPreferencesUseCase } from '@capabilities/user-preferences/domain/usecases/GetUserPreferencesUseCase'
import type { CreateRoomChatSessionUseCase } from '@features/room/domain/usecases/CreateRoomChatSessionUseCase'

export class HomeViewModel extends ViewModel {
  private readonly state = new MutableStateFlow<HomeUiState>(initialHomeState)
  private readonly effects = new MutableSharedFlow<HomeUiEffect>()
  private chatHighlightTimer: number | null = null

  readonly uiState = this.state.asStateFlow()
  readonly uiEffect = this.effects.asSharedFlow()

  constructor(
    private readonly createRoomFlowUseCase: CreateRoomFlowUseCase,
    private readonly joinRoomFlowUseCase: JoinRoomFlowUseCase,
    private readonly getRecentRoomsUseCase: GetRecentRoomsUseCase,
    private readonly saveRecentRoomVisitUseCase: SaveRecentRoomVisitUseCase,
    private readonly createRoomChatSessionUseCase: CreateRoomChatSessionUseCase,
    private readonly getUserPreferencesUseCase: GetUserPreferencesUseCase,
    private readonly connectChatUseCase: ConnectChatUseCase,
    private readonly disconnectChatUseCase: DisconnectChatUseCase,
    private readonly observeChatUseCase: ObserveChatUseCase,
    private readonly sendChatMessageUseCase: SendChatMessageUseCase,
    private readonly markChatReadUseCase: MarkChatReadUseCase,
    private readonly toggleChatReactionUseCase: ToggleChatReactionUseCase,
    private readonly editChatMessageUseCase: EditChatMessageUseCase,
    private readonly deleteChatMessageUseCase: DeleteChatMessageUseCase,
    private readonly uploadChatAttachmentUseCase: UploadChatAttachmentUseCase
  ) {
    super()
    void this.loadRecentRooms()
  }

  protected override onInit() {
    const disposables = new CompositeDisposable()
    disposables.add(
      this.observeChatUseCase.execute().subscribe((chat) => {
        this.state.update((state) => ({
          ...state,
          chatDrawer: {
            ...state.chatDrawer,
            status: chat.status,
            localParticipantId: chat.participant?.id ?? state.chatDrawer.localParticipantId,
            messages: chat.messages,
            unreadCount: chat.unreadCount,
            error: chat.lastError,
            loading: state.chatDrawer.loading && chat.status !== 'connected'
          }
        }))
      })
    )
    return disposables
  }

  onEvent(event: HomeUiAction) {
    switch (event.type) {
      case 'join-pressed':
        void this.openTypedRoom()
        break
      case 'recent-room-pressed':
        void this.openRecentRoom(event.roomId)
        break
      case 'recent-chat-pressed':
        void this.openRecentChat(event.roomId)
        break
      case 'chat-drawer-closed':
        this.closeChatDrawer()
        break
      case 'chat-draft-changed':
        this.state.update((state) => ({
          ...state,
          chatDrawer: { ...state.chatDrawer, draft: event.value }
        }))
        break
      case 'chat-message-sent':
        void this.sendChatMessage()
        break
      case 'chat-latest-visible':
        void this.markLatestChatMessageRead()
        break
      case 'chat-file-selected':
        void this.uploadChatAttachment(event.file)
        break
      case 'chat-reaction-toggled':
        void this.toggleChatReactionUseCase.execute(event.messageId, event.emoji)
        break
      case 'chat-reply-started':
        this.state.update((state) => ({
          ...state,
          chatDrawer: { ...state.chatDrawer, replyToId: event.messageId }
        }))
        break
      case 'chat-reply-preview-pressed':
        this.highlightChatMessage(event.messageId)
        break
      case 'chat-reply-cancelled':
        this.state.update((state) => ({
          ...state,
          chatDrawer: { ...state.chatDrawer, replyToId: null }
        }))
        break
      case 'chat-edit-started':
        this.startChatEdit(event.messageId)
        break
      case 'chat-edit-cancelled':
        this.state.update((state) => ({
          ...state,
          chatDrawer: { ...state.chatDrawer, editingMessageId: null, editingDraft: '' }
        }))
        break
      case 'chat-edit-draft-changed':
        this.state.update((state) => ({
          ...state,
          chatDrawer: { ...state.chatDrawer, editingDraft: event.value }
        }))
        break
      case 'chat-edit-submitted':
        void this.submitChatEdit(event.messageId)
        break
      case 'chat-message-deleted':
        void this.deleteChatMessage(event.messageId)
        break
      case 'create-room-pressed':
        void this.createRoom()
        break
      case 'id-or-link-to-join-changed':
        this.updateIdOrLink(event.value)
        break
      default:
        throw new Error(`Unknown event: ${JSON.stringify(event)}`)
    }
  }

  private updateIdOrLink(value: string) {
    const trimmed = value.trim()
    const enabled = trimmed.length > 0

    this.state.update((state) => ({
      ...state,
      idOrLinkToJoinState: {
        value,
        error: enabled ? null : 'home.errors.roomInputRequired',
        showError: false
      },
      joinButtonState: { ...state.joinButtonState, enabled },
      feedback: null
    }))
  }

  private async createRoom() {
    this.state.update((state) => ({
      ...state,
      createRoomButtonState: { ...state.createRoomButtonState, loading: true, enabled: false }
    }))

    const result = await this.createRoomFlowUseCase.execute()
    this.state.update((state) => ({
      ...state,
      createRoomButtonState: { ...state.createRoomButtonState, loading: false, enabled: true }
    }))

    if (result.ok) {
      await this.rememberRoom(result.value.roomId)
      this.effects.emit({ type: 'open-room', roomId: result.value.roomId })
    } else {
      this.effects.emit({ type: 'show-message', message: 'home.errors.createRoom' })
    }
  }

  private async openTypedRoom() {
    this.state.update((state) => ({
      ...state,
      joinButtonState: { ...state.joinButtonState, loading: true, enabled: false },
      feedback: null
    }))

    const result = await this.joinRoomFlowUseCase.execute({
      idOrLink: this.state.value.idOrLinkToJoinState.value
    })

    if (!result.ok) {
      const message = homeJoinErrorMessage(result.error.type)
      this.state.update((state) => ({
        ...state,
        idOrLinkToJoinState: {
          ...state.idOrLinkToJoinState,
          error: message,
          showError: true
        },
        joinButtonState: { ...state.joinButtonState, loading: false, enabled: true },
        feedback: message
      }))
      return
    }

    this.state.update((state) => ({
      ...state,
      joinButtonState: { ...state.joinButtonState, loading: false, enabled: true }
    }))
    await this.rememberRoom(result.value.roomId)
    this.effects.emit({ type: 'open-room', roomId: result.value.roomId })
  }

  private async openRecentRoom(roomId: string) {
    this.state.update((state) => ({ ...state, feedback: null }))

    const result = await this.joinRoomFlowUseCase.execute({ idOrLink: roomId })
    if (!result.ok) {
      const message = homeJoinErrorMessage(result.error.type)
      this.state.update((state) => ({ ...state, feedback: message }))
      return
    }

    await this.rememberRoom(result.value.roomId)
    this.effects.emit({ type: 'open-room', roomId: result.value.roomId })
  }

  private async loadRecentRooms() {
    const recentRooms = await this.getRecentRoomsUseCase.execute()
    this.state.update((state) => ({ ...state, recentRooms }))
  }

  private async rememberRoom(roomId: string) {
    const recentRooms = await this.saveRecentRoomVisitUseCase.execute({ roomId })
    this.state.update((state) => ({ ...state, recentRooms }))
  }

  private async openRecentChat(roomId: string) {
    this.disconnectChatUseCase.execute()
    this.state.update((state) => ({
      ...state,
      chatDrawer: {
        ...state.chatDrawer,
        open: true,
        roomId,
        localParticipantId: null,
        status: 'connecting',
        messages: [],
        pendingAttachments: [],
        unreadCount: 0,
        lastReadMessageId: null,
        replyToId: null,
        editingMessageId: null,
        editingDraft: '',
        highlightedMessageId: null,
        draft: '',
        loading: true,
        error: null
      }
    }))

    const preferences = await this.getUserPreferencesUseCase.execute()
    const displayName = preferences.displayName?.trim() || 'Гость'
    const session = await this.createRoomChatSessionUseCase.execute({
      roomId,
      displayName
    })

    if (!session.ok) {
      this.state.update((state) => ({
        ...state,
        chatDrawer: {
          ...state.chatDrawer,
          loading: false,
          status: 'failed',
          error: homeJoinErrorMessage(session.error.type)
        }
      }))
      return
    }

    await this.rememberRoom(roomId)
    const result = await this.connectChatUseCase.execute({
      chatUrl: session.value.chatUrl,
      chatToken: session.value.chatToken,
      chatChannelId: session.value.chatChannelId
    })

    if (!result.ok) {
      this.state.update((state) => ({
        ...state,
        chatDrawer: {
          ...state.chatDrawer,
          loading: false,
          status: 'failed',
          error: result.error.message ?? result.error.type
        }
      }))
      return
    }

    await this.markLatestChatMessageRead()
  }

  private closeChatDrawer() {
    this.disconnectChatUseCase.execute()
    if (this.chatHighlightTimer) {
      window.clearTimeout(this.chatHighlightTimer)
      this.chatHighlightTimer = null
    }
    this.state.update((state) => ({
      ...state,
      chatDrawer: initialHomeState.chatDrawer
    }))
  }

  private async sendChatMessage() {
    const chat = this.state.value.chatDrawer
    const draft = chat.draft.trim()
    if (!draft) {
      return
    }

    this.state.update((state) => ({
      ...state,
      chatDrawer: {
        ...state.chatDrawer,
        draft: '',
        replyToId: null,
        pendingAttachments: [],
        error: null
      }
    }))

    const result = await this.sendChatMessageUseCase.execute({
      markdown: draft,
      replyToId: chat.replyToId,
      attachments: chat.pendingAttachments
    })
    if (!result.ok) {
      this.state.update((state) => ({
        ...state,
        chatDrawer: {
          ...state.chatDrawer,
          draft,
          pendingAttachments: chat.pendingAttachments,
          error: result.error.message ?? result.error.type
        }
      }))
      return
    }

    await this.markLatestChatMessageRead()
  }

  private async markLatestChatMessageRead() {
    const latest = this.state.value.chatDrawer.messages.at(-1)
    if (latest) {
      await this.markChatReadUseCase.execute(latest.id)
      this.state.update((state) => ({
        ...state,
        chatDrawer: { ...state.chatDrawer, lastReadMessageId: latest.id, unreadCount: 0 }
      }))
    }
  }

  private async uploadChatAttachment(file: File) {
    const result = await this.uploadChatAttachmentUseCase.execute({ file })
    if (!result.ok) {
      this.state.update((state) => ({
        ...state,
        chatDrawer: { ...state.chatDrawer, error: result.error.message ?? result.error.type }
      }))
      return
    }
    this.state.update((state) => ({
      ...state,
      chatDrawer: {
        ...state.chatDrawer,
        pendingAttachments: [...state.chatDrawer.pendingAttachments, result.value],
        error: null
      }
    }))
  }

  private startChatEdit(messageId: string) {
    const message = this.state.value.chatDrawer.messages.find((item) => item.id === messageId)
    if (
      !message ||
      message.author.id !== this.state.value.chatDrawer.localParticipantId ||
      message.deletedAt
    ) {
      return
    }
    this.state.update((state) => ({
      ...state,
      chatDrawer: {
        ...state.chatDrawer,
        editingMessageId: messageId,
        editingDraft: message.bodyMarkdown,
        replyToId: null
      }
    }))
  }

  private async submitChatEdit(messageId: string) {
    const draft = this.state.value.chatDrawer.editingDraft.trim()
    if (!draft) {
      return
    }
    const result = await this.editChatMessageUseCase.execute(messageId, draft)
    if (!result.ok) {
      this.state.update((state) => ({
        ...state,
        chatDrawer: { ...state.chatDrawer, error: result.error.message ?? result.error.type }
      }))
      return
    }
    this.state.update((state) => ({
      ...state,
      chatDrawer: { ...state.chatDrawer, editingMessageId: null, editingDraft: '', error: null }
    }))
  }

  private async deleteChatMessage(messageId: string) {
    const message = this.state.value.chatDrawer.messages.find((item) => item.id === messageId)
    if (!message || message.author.id !== this.state.value.chatDrawer.localParticipantId) {
      return
    }
    const result = await this.deleteChatMessageUseCase.execute(messageId)
    if (!result.ok) {
      this.state.update((state) => ({
        ...state,
        chatDrawer: { ...state.chatDrawer, error: result.error.message ?? result.error.type }
      }))
    }
  }

  private highlightChatMessage(messageId: string) {
    if (this.chatHighlightTimer) {
      window.clearTimeout(this.chatHighlightTimer)
    }
    this.state.update((state) => ({
      ...state,
      chatDrawer: { ...state.chatDrawer, highlightedMessageId: messageId }
    }))
    this.chatHighlightTimer = window.setTimeout(() => {
      this.chatHighlightTimer = null
      this.state.update((state) =>
        state.chatDrawer.highlightedMessageId === messageId
          ? { ...state, chatDrawer: { ...state.chatDrawer, highlightedMessageId: null } }
          : state
      )
    }, 1500)
  }
}

function homeJoinErrorMessage(
  error: 'invalid-room-input' | 'room-not-found' | 'unknown-error'
): HomeErrorMessageKey {
  switch (error) {
    case 'invalid-room-input':
      return 'home.errors.invalidRoom'
    case 'room-not-found':
      return 'home.errors.roomNotFound'
    default:
      return 'home.errors.checkRoom'
  }
}
