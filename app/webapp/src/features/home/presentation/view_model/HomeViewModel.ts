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
import type { GetUserPreferencesUseCase } from '@capabilities/user-preferences/domain/usecases/GetUserPreferencesUseCase'
import type { JoinRoomUseCase } from '@features/room/domain/usecases/JoinRoomUseCase'

export class HomeViewModel extends ViewModel {
  private readonly state = new MutableStateFlow<HomeUiState>(initialHomeState)
  private readonly effects = new MutableSharedFlow<HomeUiEffect>()

  readonly uiState = this.state.asStateFlow()
  readonly uiEffect = this.effects.asSharedFlow()

  constructor(
    private readonly createRoomFlowUseCase: CreateRoomFlowUseCase,
    private readonly joinRoomFlowUseCase: JoinRoomFlowUseCase,
    private readonly getRecentRoomsUseCase: GetRecentRoomsUseCase,
    private readonly saveRecentRoomVisitUseCase: SaveRecentRoomVisitUseCase,
    private readonly joinRoomUseCase: JoinRoomUseCase,
    private readonly getUserPreferencesUseCase: GetUserPreferencesUseCase,
    private readonly connectChatUseCase: ConnectChatUseCase,
    private readonly disconnectChatUseCase: DisconnectChatUseCase,
    private readonly observeChatUseCase: ObserveChatUseCase,
    private readonly sendChatMessageUseCase: SendChatMessageUseCase,
    private readonly markChatReadUseCase: MarkChatReadUseCase
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
            messages: chat.messages,
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
        status: 'connecting',
        messages: [],
        draft: '',
        loading: true,
        error: null
      }
    }))

    const preferences = await this.getUserPreferencesUseCase.execute()
    const displayName = preferences.displayName?.trim() || 'Гость'
    const session = await this.joinRoomUseCase.execute({
      roomId,
      displayName,
      micEnabled: false,
      cameraEnabled: false,
      role: 'participant'
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

    if (!session.value.chatUrl || !session.value.chatToken || !session.value.chatChannelId) {
      this.state.update((state) => ({
        ...state,
        chatDrawer: {
          ...state.chatDrawer,
          loading: false,
          status: 'failed',
          error: 'Chat is not available for this room'
        }
      }))
      return
    }

    await this.rememberRoom(session.value.roomId)
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
    this.state.update((state) => ({
      ...state,
      chatDrawer: initialHomeState.chatDrawer
    }))
  }

  private async sendChatMessage() {
    const draft = this.state.value.chatDrawer.draft.trim()
    if (!draft) {
      return
    }

    this.state.update((state) => ({
      ...state,
      chatDrawer: { ...state.chatDrawer, draft: '', error: null }
    }))

    const result = await this.sendChatMessageUseCase.execute({ markdown: draft })
    if (!result.ok) {
      this.state.update((state) => ({
        ...state,
        chatDrawer: {
          ...state.chatDrawer,
          draft,
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
    }
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
