import { CompositeDisposable, MutableSharedFlow, MutableStateFlow, ViewModel } from '@kvt/core'
import type { Participant } from '@features/room/domain/model/Participant'
import type { PlayConferenceSoundUseCase } from '@capabilities/conference-audio/domain/usecases/PlayConferenceSoundUseCase'
import type { ObserveVoiceActivityUseCase } from '@capabilities/voice-activity/domain/usecases/ObserveVoiceActivityUseCase'
import type { StopVoiceActivityUseCase } from '@capabilities/voice-activity/domain/usecases/StopVoiceActivityUseCase'
import type { UpdateVoiceActivitySourcesUseCase } from '@capabilities/voice-activity/domain/usecases/UpdateVoiceActivitySourcesUseCase'
import type { ConnectChatUseCase } from '@capabilities/chat/domain/usecases/ConnectChatUseCase'
import type { DeleteChatMessageUseCase } from '@capabilities/chat/domain/usecases/DeleteChatMessageUseCase'
import type { DisconnectChatUseCase } from '@capabilities/chat/domain/usecases/DisconnectChatUseCase'
import type { EditChatMessageUseCase } from '@capabilities/chat/domain/usecases/EditChatMessageUseCase'
import type { MarkChatReadUseCase } from '@capabilities/chat/domain/usecases/MarkChatReadUseCase'
import type { ObserveChatUseCase } from '@capabilities/chat/domain/usecases/ObserveChatUseCase'
import type { SendChatMessageUseCase } from '@capabilities/chat/domain/usecases/SendChatMessageUseCase'
import type { ToggleChatReactionUseCase } from '@capabilities/chat/domain/usecases/ToggleChatReactionUseCase'
import type { UploadChatAttachmentUseCase } from '@capabilities/chat/domain/usecases/UploadChatAttachmentUseCase'
import type { RtcDiagnostics, RtcSession } from '@capabilities/rtc/domain/model'
import type { ConnectToRoomRtcUseCase } from '@capabilities/rtc/domain/usecases/ConnectToRoomRtcUseCase'
import type { LoadJoinSessionUseCase } from '@capabilities/session/domain/usecases/LoadJoinSessionUseCase'
import type { GetUserPreferencesUseCase } from '@capabilities/user-preferences/domain/usecases/GetUserPreferencesUseCase'
import type { StoredJoinSession } from '@capabilities/session/domain/model/JoinSession'
import type { ClearJoinSessionUseCase } from '@capabilities/session/domain/usecases/ClearJoinSessionUseCase'
import type { ExportClientLogsUseCase } from '@capabilities/client-logs/domain/usecases/ExportClientLogsUseCase'
import type { ClearClientLogsUseCase } from '@capabilities/client-logs/domain/usecases/ClearClientLogsUseCase'
import type { CopyRoomLinkUseCase } from '@features/room/domain/usecases/CopyRoomLinkUseCase'
import type { GetRoomMetadataUseCase } from '@features/room/domain/usecases/GetRoomMetadataUseCase'
import type { LeaveRoomUseCase } from '@features/room/domain/usecases/LeaveRoomUseCase'
import type { ObserveRoomDiagnosticsUseCase } from '@features/room/domain/usecases/ObserveRoomDiagnosticsUseCase'
import type { ObserveRoomSessionUseCase } from '@features/room/domain/usecases/ObserveRoomSessionUseCase'
import type { ToggleRoomCameraUseCase } from '@features/room/domain/usecases/ToggleRoomCameraUseCase'
import type { ToggleRoomMicrophoneUseCase } from '@features/room/domain/usecases/ToggleRoomMicrophoneUseCase'
import type { ToggleRoomScreenShareUseCase } from '@features/room/domain/usecases/ToggleRoomScreenShareUseCase'
import {
  initialRoomState,
  type RoomUiAction,
  type RoomUiEffect,
  type RoomUiState
} from '../model/RoomState'
import { createDiagnostics } from './room-diagnostics-builder'
import { RoomRequestGuards } from './room-request-guards'
import { diffRemoteConferenceSounds } from './room-sound-diff'
import { hasEnabledSlot, participantHasEnabledSlot, updateLocalSlot } from './room-slot-helpers'
import { buildVoiceActivitySources } from './room-voice-activity-sources'

type RoomControlKey = 'microphone' | 'camera' | 'screenShare'
type RoomControl = RoomUiState[RoomControlKey]
type RoomToastMessageKey = Extract<RoomUiEffect, { readonly type: 'show-toast' }>['message']
type ParticipantSlotKind = Participant['slots'][number]['kind']

type ToggleRoomControlOptions = {
  readonly control: RoomControlKey
  readonly slotKind: ParticipantSlotKind
  readonly failedToast: RoomToastMessageKey
  readonly enabledStatus: RoomUiState['actionStatus']
  readonly disabledStatus: RoomUiState['actionStatus']
  readonly getPublishing: (enabled: boolean) => boolean
  readonly execute: (enabled: boolean) => Promise<{ readonly ok: boolean }>
}

type RoomOpenErrorConfig = {
  readonly actionStatus: RoomUiState['actionStatus']
  readonly error: NonNullable<RoomUiState['error']>
}

export class RoomViewModel extends ViewModel {
  private readonly state = new MutableStateFlow<RoomUiState>(initialRoomState)
  private readonly effects = new MutableSharedFlow<RoomUiEffect>()

  private latestDiagnostics: RtcDiagnostics | null = null
  private lastConferenceSoundParticipants: readonly Participant[] | null = null
  private chatHighlightTimer: number | null = null

  // Guard-ы не дают старым async-ответам перезаписать состояние уже другой комнаты.
  private readonly requestGuards = new RoomRequestGuards()

  readonly uiState = this.state.asStateFlow()
  readonly uiEffect = this.effects.asSharedFlow()

  constructor(
    private readonly loadJoinSessionUseCase: LoadJoinSessionUseCase,
    private readonly getUserPreferencesUseCase: GetUserPreferencesUseCase,
    private readonly getRoomMetadataUseCase: GetRoomMetadataUseCase,
    private readonly connectToRoomRtcUseCase: ConnectToRoomRtcUseCase,
    private readonly observeRoomSessionUseCase: ObserveRoomSessionUseCase,
    private readonly observeRoomDiagnosticsUseCase: ObserveRoomDiagnosticsUseCase,
    private readonly toggleRoomMicrophoneUseCase: ToggleRoomMicrophoneUseCase,
    private readonly toggleRoomCameraUseCase: ToggleRoomCameraUseCase,
    private readonly toggleRoomScreenShareUseCase: ToggleRoomScreenShareUseCase,
    private readonly copyRoomLinkUseCase: CopyRoomLinkUseCase,
    private readonly exportClientLogsUseCase: ExportClientLogsUseCase,
    private readonly clearClientLogsUseCase: ClearClientLogsUseCase,
    private readonly clearJoinSessionUseCase: ClearJoinSessionUseCase,
    private readonly leaveRoomUseCase: LeaveRoomUseCase,
    private readonly playConferenceSoundUseCase: PlayConferenceSoundUseCase,
    private readonly observeVoiceActivityUseCase: ObserveVoiceActivityUseCase,
    private readonly updateVoiceActivitySourcesUseCase: UpdateVoiceActivitySourcesUseCase,
    private readonly stopVoiceActivityUseCase: StopVoiceActivityUseCase,
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
  }

  protected override onInit() {
    const disposables = new CompositeDisposable()

    disposables.add(
      this.observeRoomSessionUseCase.execute().subscribe((session) => {
        this.updateState((state) => {
          const nextState = this.applyObservedSession(state, session)
          this.playObservedConferenceSounds(nextState)
          return nextState
        })
      })
    )

    disposables.add(
      this.observeRoomDiagnosticsUseCase.execute().subscribe((diagnostics) => {
        this.latestDiagnostics = diagnostics

        this.updateState((state) =>
          state.activePanel === 'techInfo' ? this.withDiagnostics(state, null) : state
        )
      })
    )

    disposables.add(
      this.observeChatUseCase.execute().subscribe((chat) => {
        this.updateState((state) => ({
          ...state,
          chat: {
            ...state.chat,
            status: chat.status,
            messages: chat.messages,
            unreadCount: chat.unreadCount,
            error: chat.lastError
          }
        }))
      })
    )

    disposables.add(
      this.observeVoiceActivityUseCase.execute().subscribe((speakingParticipantIds) => {
        this.updateState((state) => ({
          ...state,
          speakingParticipantIds
        }))
      })
    )

    return disposables
  }

  onEvent(event: RoomUiAction) {
    switch (event.type) {
      case 'room-opened':
        void this.openRoom(event.roomId)
        break
      case 'room-closed':
        void this.closeRoom()
        break
      case 'go-home-pressed':
        this.effects.emit({ type: 'navigate-home' })
        break
      case 'prejoin-completed':
        void this.enterRoom()
        break
      case 'microphone-toggled':
        void this.toggleMicrophone()
        break
      case 'camera-toggled':
        void this.toggleCamera()
        break
      case 'screen-share-toggled':
        void this.toggleScreenShare()
        break
      case 'copy-link-pressed':
        void this.copyRoomLink()
        break
      case 'export-logs-pressed':
        this.exportLogs()
        break
      case 'clear-logs-pressed':
        this.clearLogs()
        break
      case 'leave-pressed':
        void this.leaveRoom()
        break
      case 'panel-toggled':
        this.updateState((state) => {
          const activePanel = state.activePanel === event.panel ? null : event.panel
          const nextState = {
            ...state,
            activePanel,
            chat: {
              ...state.chat,
              open: event.panel === 'chat' ? state.activePanel !== 'chat' : state.chat.open
            }
          }

          return activePanel === 'techInfo' ? this.withDiagnostics(nextState, null) : nextState
        })
        if (event.panel === 'chat') {
          void this.markLatestChatMessageRead()
        }
        break
      case 'panel-closed':
        this.updateState((state) => ({
          ...state,
          activePanel: null,
          chat: { ...state.chat, open: false }
        }))
        break
      case 'tile-pin-toggled':
        this.updateState((state) => ({
          ...state,
          pinnedTileId: state.pinnedTileId === event.tileId ? null : event.tileId
        }))
        break
      case 'settings-opened':
        this.updateState((state) => ({ ...state, settingsOpen: true }))
        break
      case 'settings-closed':
        this.updateState((state) => ({ ...state, settingsOpen: false }))
        break
      case 'chat-draft-changed':
        this.updateState((state) => ({ ...state, chat: { ...state.chat, draft: event.value } }))
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
        this.updateState((state) => ({
          ...state,
          chat: { ...state.chat, replyToId: event.messageId }
        }))
        break
      case 'chat-reply-preview-pressed':
        this.highlightChatMessage(event.messageId)
        break
      case 'chat-reply-cancelled':
        this.updateState((state) => ({ ...state, chat: { ...state.chat, replyToId: null } }))
        break
      case 'chat-edit-started':
        this.startChatEdit(event.messageId)
        break
      case 'chat-edit-cancelled':
        this.updateState((state) => ({
          ...state,
          chat: { ...state.chat, editingMessageId: null, editingDraft: '' }
        }))
        break
      case 'chat-edit-draft-changed':
        this.updateState((state) => ({
          ...state,
          chat: { ...state.chat, editingDraft: event.value }
        }))
        break
      case 'chat-edit-submitted':
        void this.submitChatEdit(event.messageId)
        break
      case 'chat-message-deleted':
        void this.deleteChatMessage(event.messageId)
        break
      default:
        throw new Error(`Unknown event: ${JSON.stringify(event)}`)
    }
  }

  private async openRoom(roomId: string) {
    const normalizedRoomId = roomId.trim()

    if (!normalizedRoomId) {
      this.effects.emit({ type: 'navigate-home' })
      return
    }

    const current = this.state.value

    if (
      current.roomId === normalizedRoomId &&
      (current.status === 'connecting' || current.status === 'connected' || current.prejoinOpen) &&
      !current.error
    ) {
      return
    }

    const requestId = this.requestGuards.next('openRoom')

    // Смена комнаты делает неактуальными старые подключения и pending-toggle операции.
    this.requestGuards.invalidate('enterRoom', 'connectRoom', 'microphone', 'camera', 'screenShare')
    this.latestDiagnostics = null
    this.lastConferenceSoundParticipants = null
    if (this.chatHighlightTimer) {
      window.clearTimeout(this.chatHighlightTimer)
      this.chatHighlightTimer = null
    }
    this.stopVoiceActivityUseCase.execute()
    this.disconnectChatUseCase.execute()

    this.updateState((state) => this.createOpeningRoomState(state, normalizedRoomId))

    const room = await this.getRoomMetadataUseCase.execute({ roomId: normalizedRoomId })

    if (!this.isActualOpenRoomRequest(requestId)) {
      return
    }

    if (!room.ok) {
      await this.clearJoinSessionUseCase.execute(normalizedRoomId)

      if (!this.isActualOpenRoomRequest(requestId)) {
        return
      }

      this.updateState((state) => ({
        ...state,
        status: 'failed',
        prejoinOpen: false,
        ...roomOpenError(room.error.type)
      }))

      return
    }

    const storedSession = await this.loadJoinSessionUseCase.execute(normalizedRoomId)

    if (!this.isActualOpenRoomRequest(requestId)) {
      return
    }

    if (storedSession.ok) {
      await this.connectStoredSession(storedSession.value, requestId)
      return
    }

    this.updateState((state) => ({
      ...state,
      status: 'idle',
      prejoinOpen: true,
      actionStatus: 'room.status.chooseSettings'
    }))
  }

  private async enterRoom() {
    const requestId = this.requestGuards.next('enterRoom')
    const roomId = this.state.value.roomId

    const storedSession = await this.loadJoinSessionUseCase.execute(roomId)

    if (!this.isActualEnterRoomRequest(requestId) || this.state.value.roomId !== roomId) {
      return
    }

    if (!storedSession.ok) {
      this.effects.emit({ type: 'show-toast', message: 'room.toasts.sessionMissing' })
      return
    }

    await this.connectStoredSession(storedSession.value, undefined, true)
  }

  private async toggleMicrophone() {
    await this.toggleRoomControl({
      control: 'microphone',
      slotKind: 'audio',
      failedToast: 'room.toasts.microphoneFailed',
      enabledStatus: 'room.status.microphoneOn',
      disabledStatus: 'room.status.microphoneMuted',
      getPublishing: (enabled) => enabled,
      execute: (enabled) => this.toggleRoomMicrophoneUseCase.execute(enabled)
    })
  }

  private async toggleCamera() {
    await this.toggleRoomControl({
      control: 'camera',
      slotKind: 'camera',
      failedToast: 'room.toasts.cameraFailed',
      enabledStatus: 'room.status.cameraOn',
      disabledStatus: 'room.status.cameraOff',
      getPublishing: (enabled) => enabled,
      execute: (enabled) => this.toggleRoomCameraUseCase.execute(enabled)
    })
  }

  private async toggleScreenShare() {
    await this.toggleRoomControl({
      control: 'screenShare',
      slotKind: 'screen',
      failedToast: 'room.toasts.screenFailed',
      enabledStatus: 'room.status.screenStarted',
      disabledStatus: 'room.status.screenStopped',
      getPublishing: (enabled) => enabled,
      execute: (enabled) => this.toggleRoomScreenShareUseCase.execute(enabled)
    })
  }

  private async toggleRoomControl(options: ToggleRoomControlOptions) {
    const currentControl = this.getControl(this.state.value, options.control)

    if (currentControl.loading) {
      return
    }

    const enabled = !currentControl.enabled
    const requestId = this.nextControlRequestId(options.control)

    this.updateState((state) =>
      this.updateControl(state, options.control, (control) => ({
        ...control,
        loading: true,
        error: null
      }))
    )

    const result = await options.execute(enabled)

    if (!this.isActualControlRequest(options.control, requestId)) {
      return
    }

    if (!result.ok) {
      this.updateState((state) =>
        this.updateControl(state, options.control, (control) => ({
          ...control,
          loading: false
        }))
      )

      this.effects.emit({ type: 'show-toast', message: options.failedToast })
      return
    }

    this.updateState((state) => {
      const nextState = this.updateControl(state, options.control, (control) => ({
        ...control,
        enabled,
        loading: false,
        error: null
      }))

      return {
        ...nextState,
        participants: updateLocalSlot(
          nextState,
          options.slotKind,
          enabled,
          options.getPublishing(enabled)
        ),
        actionStatus: enabled ? options.enabledStatus : options.disabledStatus
      }
    })

    this.playLocalControlSound(options.control, enabled)
  }

  private async copyRoomLink() {
    const roomId = this.state.value.roomId

    const result = await this.copyRoomLinkUseCase.execute({
      roomId,
      origin: window.location.origin
    })

    this.effects.emit({
      type: 'show-toast',
      message: result.ok ? 'room.toasts.linkCopied' : 'room.toasts.linkCopyFailed'
    })

    this.updateState((state) => ({
      ...state,
      actionStatus: result.ok ? 'room.status.linkCopied' : 'room.status.linkCopyFailed'
    }))
  }

  private exportLogs() {
    this.effects.emit({ type: 'download-logs', ...this.exportClientLogsUseCase.execute() })
    this.effects.emit({ type: 'show-toast', message: 'room.toasts.logsPrepared' })
  }

  private clearLogs() {
    this.clearClientLogsUseCase.execute()

    this.effects.emit({ type: 'show-toast', message: 'room.toasts.logsCleared' })

    this.updateState((state) => ({
      ...state,
      actionStatus: 'room.status.logsCleared'
    }))
  }

  private async connectStoredSession(
    session: StoredJoinSession,
    openRoomRequestId?: number,
    showExpiredToast = false
  ) {
    const requestId = this.requestGuards.next('connectRoom')
    const preferences = await this.getUserPreferencesUseCase.execute()

    this.updateState((state) => ({
      ...state,
      prejoinOpen: false,
      status: 'connecting',
      actionStatus: 'room.status.mediaStarting',
      error: null
    }))

    const result = await this.connectToRoomRtcUseCase.execute({
      roomId: session.roomId,
      participantId: session.participantId,
      wsUrl: session.wsUrl,
      rmsUrl: session.rmsUrl,
      joinToken: session.joinToken,
      iceServers: session.iceServers,
      micEnabled: hasEnabledSlot(session.snapshot.participants, session.participantId, 'audio'),
      cameraEnabled: hasEnabledSlot(session.snapshot.participants, session.participantId, 'camera'),
      microphoneDeviceId: preferences.preferredMicrophoneId,
      audioProcessing: preferences.audioProcessing
    })

    if (!this.isActualConnectRoomRequest(requestId)) {
      return
    }

    if (openRoomRequestId !== undefined && !this.isActualOpenRoomRequest(openRoomRequestId)) {
      return
    }

    if (this.state.value.roomId !== session.roomId) {
      return
    }

    if (!result.ok) {
      await this.clearJoinSessionUseCase.execute(session.roomId)

      if (!this.isActualConnectRoomRequest(requestId)) {
        return
      }

      this.updateState((state) => ({
        ...state,
        status: 'idle',
        prejoinOpen: true,
        participants: [],
        localParticipantId: null,
        localMediaStreams: {},
        remoteMediaStreams: {},
        microphone: {
          ...state.microphone,
          loading: false
        },
        camera: {
          ...state.camera,
          loading: false
        },
        screenShare: {
          ...state.screenShare,
          enabled: false,
          loading: false
        },
        actionStatus: 'room.status.sessionExpired'
      }))

      if (showExpiredToast) {
        this.effects.emit({ type: 'show-toast', message: 'room.toasts.sessionExpired' })
      }

      return
    }

    if (session.chatUrl && session.chatToken && session.chatChannelId) {
      const chatResult = await this.connectChatUseCase.execute({
        chatUrl: session.chatUrl,
        chatToken: session.chatToken,
        chatChannelId: session.chatChannelId
      })

      if (!chatResult.ok) {
        this.updateState((state) => ({
          ...state,
          chat: {
            ...state.chat,
            error: chatResult.error.message ?? chatResult.error.type
          }
        }))
      }
    }

    this.updateState((state) => ({
      ...state,
      participants: session.snapshot.participants as Participant[],
      localParticipantId: session.participantId,
      localMediaStreams: state.localMediaStreams,
      remoteMediaStreams: state.remoteMediaStreams,
      microphone: {
        ...state.microphone,
        loading: false,
        enabled: hasEnabledSlot(session.snapshot.participants, session.participantId, 'audio')
      },
      camera: {
        ...state.camera,
        loading: false,
        enabled: hasEnabledSlot(session.snapshot.participants, session.participantId, 'camera')
      },
      actionStatus: 'room.status.mediaStarting'
    }))

    this.playConferenceSoundUseCase.execute('conference-joined')
  }

  private async leaveRoom() {
    const roomId = this.state.value.roomId

    this.cleanupRoomRuntime()
    await this.clearJoinSessionUseCase.execute(roomId)

    this.updateState(() => initialRoomState)
    this.effects.emit({ type: 'navigate-home' })
  }

  private async closeRoom() {
    const roomId = this.state.value.roomId
    this.cleanupRoomRuntime()
    if (roomId) {
      await this.clearJoinSessionUseCase.execute(roomId)
    }
    this.updateState(() => initialRoomState)
  }

  private cleanupRoomRuntime() {
    this.requestGuards.invalidate(
      'openRoom',
      'enterRoom',
      'connectRoom',
      'microphone',
      'camera',
      'screenShare'
    )
    this.latestDiagnostics = null
    this.lastConferenceSoundParticipants = null
    if (this.chatHighlightTimer) {
      window.clearTimeout(this.chatHighlightTimer)
      this.chatHighlightTimer = null
    }

    this.leaveRoomUseCase.execute()
    this.stopVoiceActivityUseCase.execute()
    this.disconnectChatUseCase.execute()
  }

  private async sendChatMessage() {
    const chat = this.state.value.chat
    const markdown = chat.draft.trim()
    if (!markdown && chat.pendingAttachments.length === 0) {
      return
    }

    this.updateState((state) => ({
      ...state,
      chat: { ...state.chat, draft: '', replyToId: null, pendingAttachments: [] }
    }))

    const result = await this.sendChatMessageUseCase.execute({
      markdown,
      replyToId: chat.replyToId,
      attachments: chat.pendingAttachments
    })

    if (!result.ok) {
      this.updateState((state) => ({
        ...state,
        chat: {
          ...state.chat,
          draft: markdown,
          pendingAttachments: chat.pendingAttachments,
          error: result.error.message ?? result.error.type
        }
      }))
      return
    }

    await this.markLatestChatMessageRead()
  }

  private async uploadChatAttachment(file: File) {
    const result = await this.uploadChatAttachmentUseCase.execute({ file })
    if (!result.ok) {
      this.updateState((state) => ({
        ...state,
        chat: { ...state.chat, error: result.error.message ?? result.error.type }
      }))
      return
    }
    this.updateState((state) => ({
      ...state,
      chat: {
        ...state.chat,
        pendingAttachments: [...state.chat.pendingAttachments, result.value],
        error: null
      }
    }))
  }

  private async markLatestChatMessageRead() {
    const latest = this.state.value.chat.messages.at(-1)
    if (!latest) {
      return
    }
    await this.markChatReadUseCase.execute(latest.id)
    this.updateState((state) => ({
      ...state,
      chat: { ...state.chat, lastReadMessageId: latest.id, unreadCount: 0 }
    }))
  }

  private startChatEdit(messageId: string) {
    const message = this.state.value.chat.messages.find((item) => item.id === messageId)
    if (!message || message.author.id !== this.state.value.localParticipantId || message.deletedAt) {
      return
    }

    this.updateState((state) => ({
      ...state,
      chat: {
        ...state.chat,
        editingMessageId: messageId,
        editingDraft: message.bodyMarkdown,
        replyToId: null
      }
    }))
  }

  private async submitChatEdit(messageId: string) {
    const draft = this.state.value.chat.editingDraft.trim()
    if (!draft) {
      return
    }

    const result = await this.editChatMessageUseCase.execute(messageId, draft)
    if (!result.ok) {
      this.updateState((state) => ({
        ...state,
        chat: { ...state.chat, error: result.error.message ?? result.error.type }
      }))
      return
    }

    this.updateState((state) => ({
      ...state,
      chat: { ...state.chat, editingMessageId: null, editingDraft: '', error: null }
    }))
  }

  private async deleteChatMessage(messageId: string) {
    const message = this.state.value.chat.messages.find((item) => item.id === messageId)
    if (!message || message.author.id !== this.state.value.localParticipantId) {
      return
    }

    const result = await this.deleteChatMessageUseCase.execute(messageId)
    if (!result.ok) {
      this.updateState((state) => ({
        ...state,
        chat: { ...state.chat, error: result.error.message ?? result.error.type }
      }))
    }
  }

  private highlightChatMessage(messageId: string) {
    if (this.chatHighlightTimer) {
      window.clearTimeout(this.chatHighlightTimer)
    }

    this.updateState((state) => ({
      ...state,
      chat: { ...state.chat, highlightedMessageId: messageId }
    }))

    this.chatHighlightTimer = window.setTimeout(() => {
      this.chatHighlightTimer = null
      this.updateState((state) =>
        state.chat.highlightedMessageId === messageId
          ? { ...state, chat: { ...state.chat, highlightedMessageId: null } }
          : state
      )
    }, 1500)
  }

  private applyObservedSession(state: RoomUiState, session: RtcSession): RoomUiState {
    if (!state.roomId) {
      return state
    }

    // Observable может отдать старую RTC-сессию уже после открытия другой комнаты.
    if (state.roomId && session.roomId && state.roomId !== session.roomId) {
      return state
    }

    const nextState: RoomUiState = {
      ...state,
      status: session.status,
      roomId: session.roomId || state.roomId,
      localParticipantId: session.participantId || state.localParticipantId,
      participants: (session.snapshot?.participants ?? state.participants) as Participant[],
      localMediaStreams: session.localMediaStreams,
      remoteMediaStreams: session.remoteMediaStreams
    }

    // Если RTC-сессия прислала новый snapshot, UI-контролы лучше синхронизировать с ним.
    const syncedState = this.withDiagnostics(
      this.syncControlsWithLocalParticipant(nextState),
      session
    )
    this.updateVoiceActivitySources(syncedState)

    return syncedState
  }

  private playLocalControlSound(control: RoomControlKey, enabled: boolean) {
    switch (control) {
      case 'microphone':
        this.playConferenceSoundUseCase.execute(enabled ? 'microphone-on' : 'microphone-off')
        break
      case 'camera':
        this.playConferenceSoundUseCase.execute(enabled ? 'camera-on' : 'camera-off')
        break
      case 'screenShare':
        this.playConferenceSoundUseCase.execute(
          enabled ? 'screen-share-outgoing' : 'screen-share-stopped-outgoing'
        )
        break
    }
  }

  private playObservedConferenceSounds(nextState: RoomUiState) {
    if (!nextState.localParticipantId || nextState.prejoinOpen) {
      this.lastConferenceSoundParticipants = null
      return
    }

    const previousParticipants = this.lastConferenceSoundParticipants
    this.lastConferenceSoundParticipants = nextState.participants

    if (!previousParticipants) {
      return
    }

    for (const sound of diffRemoteConferenceSounds(
      previousParticipants,
      nextState.participants,
      nextState.localParticipantId
    )) {
      this.playConferenceSoundUseCase.execute(sound)
    }
  }

  private updateVoiceActivitySources(state: RoomUiState) {
    if (!state.localParticipantId || state.prejoinOpen) {
      this.stopVoiceActivityUseCase.execute()
      return
    }

    this.updateVoiceActivitySourcesUseCase.execute(buildVoiceActivitySources(state))
  }

  private createOpeningRoomState(state: RoomUiState, roomId: string): RoomUiState {
    return {
      ...state,
      roomId,
      prejoinOpen: false,
      status: 'connecting',
      participants: [],
      localParticipantId: null,
      localMediaStreams: {},
      remoteMediaStreams: {},
      error: null,
      activePanel: null,
      pinnedTileId: null,
      speakingParticipantIds: [],
      chat: {
        ...state.chat,
        open: false,
        draft: '',
        messages: [],
        unreadCount: 0,
        lastReadMessageId: null,
        replyToId: null,
        editingMessageId: null,
        editingDraft: '',
        highlightedMessageId: null,
        error: null,
        status: 'idle'
      },
      actionStatus: 'room.status.checkingRoom',
      diagnostics: null,
      microphone: {
        ...state.microphone,
        loading: false,
        error: null
      },
      camera: {
        ...state.camera,
        loading: false,
        error: null
      },
      screenShare: {
        ...state.screenShare,
        enabled: false,
        loading: false,
        error: null
      }
    }
  }

  private syncControlsWithLocalParticipant(state: RoomUiState): RoomUiState {
    if (!state.localParticipantId) {
      return state
    }

    const localParticipant = state.participants.find(
      (participant) => participant.id === state.localParticipantId
    )

    if (!localParticipant) {
      return state
    }

    return {
      ...state,
      microphone: {
        ...state.microphone,
        enabled: Boolean(state.localMediaStreams.audio) || participantHasEnabledSlot(localParticipant, 'audio')
      },
      camera: {
        ...state.camera,
        enabled: Boolean(state.localMediaStreams.camera) || participantHasEnabledSlot(localParticipant, 'camera')
      },
      screenShare: {
        ...state.screenShare,
        enabled: participantHasEnabledSlot(localParticipant, 'screen')
      }
    }
  }

  private withDiagnostics(state: RoomUiState, session: RtcSession | null): RoomUiState {
    return {
      ...state,
      diagnostics: createDiagnostics(state, session, this.latestDiagnostics)
    }
  }

  private updateState(updater: (state: RoomUiState) => RoomUiState) {
    this.state.update((state) => updater(state))
  }

  private getControl(state: RoomUiState, control: RoomControlKey): RoomControl {
    switch (control) {
      case 'microphone':
        return state.microphone
      case 'camera':
        return state.camera
      case 'screenShare':
        return state.screenShare
    }
  }

  private updateControl(
    state: RoomUiState,
    control: RoomControlKey,
    updater: (control: RoomControl) => RoomControl
  ): RoomUiState {
    switch (control) {
      case 'microphone':
        return {
          ...state,
          microphone: updater(state.microphone)
        }
      case 'camera':
        return {
          ...state,
          camera: updater(state.camera)
        }
      case 'screenShare':
        return {
          ...state,
          screenShare: updater(state.screenShare)
        }
    }
  }

  private nextControlRequestId(control: RoomControlKey): number {
    switch (control) {
      case 'microphone':
        return this.requestGuards.next('microphone')
      case 'camera':
        return this.requestGuards.next('camera')
      case 'screenShare':
        return this.requestGuards.next('screenShare')
    }
  }

  private isActualControlRequest(control: RoomControlKey, requestId: number): boolean {
    switch (control) {
      case 'microphone':
        return this.requestGuards.isActual('microphone', requestId)
      case 'camera':
        return this.requestGuards.isActual('camera', requestId)
      case 'screenShare':
        return this.requestGuards.isActual('screenShare', requestId)
    }
  }

  private isActualOpenRoomRequest(requestId: number): boolean {
    return this.requestGuards.isActual('openRoom', requestId)
  }

  private isActualEnterRoomRequest(requestId: number): boolean {
    return this.requestGuards.isActual('enterRoom', requestId)
  }

  private isActualConnectRoomRequest(requestId: number): boolean {
    return this.requestGuards.isActual('connectRoom', requestId)
  }
}

const roomOpenErrors = {
  'room-not-found': {
    actionStatus: 'room.status.roomUnavailable',
    error: {
      title: 'room.errors.roomUnavailable.title',
      description: 'room.errors.roomUnavailable.description',
      actionLabel: 'room.errors.roomUnavailable.action'
    }
  },
  default: {
    actionStatus: 'room.status.roomCheckFailed',
    error: {
      title: 'room.errors.roomCheckFailed.title',
      description: 'room.errors.roomCheckFailed.description',
      actionLabel: 'room.errors.roomCheckFailed.action'
    }
  }
} satisfies Record<'room-not-found' | 'default', RoomOpenErrorConfig>

function roomOpenError(errorType: string): RoomOpenErrorConfig {
  return errorType === 'room-not-found' ? roomOpenErrors['room-not-found'] : roomOpenErrors.default
}
