import type { ConferenceDiagnostics } from '@features/room/presentation/model/RoomDiagnostics'
import type { RoomControlState } from '@features/room/domain/model/RoomControls'
import type { Participant } from '@features/room/domain/model/Participant'
import type { RtcConnectionStatus, RtcMediaStreams } from '@capabilities/rtc/domain/model'
import type { ChatMessage, ChatConnectionStatus } from '@capabilities/chat/domain/model/Chat'
import type { PrefixedTranslationKey } from '@core/i18n/translation-key'

export type RoomStatusMessageKey = PrefixedTranslationKey<'voice', 'room.status'>
export type RoomToastMessageKey = PrefixedTranslationKey<'voice', 'room.toasts'>
export type RoomErrorMessageKey = PrefixedTranslationKey<'voice', 'room.errors'>
export type RoomPanel = 'participants' | 'roomInfo' | 'techInfo' | 'chat'

export type RoomChatState = {
  readonly status: ChatConnectionStatus
  readonly open: boolean
  readonly draft: string
  readonly messages: readonly ChatMessage[]
  readonly pendingAttachments: readonly ChatMessage['attachments'][number][]
  readonly unreadCount: number
  readonly lastReadMessageId: string | null
  readonly replyToId: string | null
  readonly editingMessageId: string | null
  readonly editingDraft: string
  readonly highlightedMessageId: string | null
  readonly error: string | null
}

export type RoomUiState = {
  readonly roomId: string
  readonly prejoinOpen: boolean
  readonly status: RtcConnectionStatus
  readonly participants: readonly Participant[]
  readonly localParticipantId: string | null
  readonly localMediaStreams: RtcMediaStreams
  readonly remoteMediaStreams: Readonly<Record<string, RtcMediaStreams>>
  readonly microphone: RoomControlState
  readonly camera: RoomControlState
  readonly screenShare: RoomControlState
  readonly actionStatus: RoomStatusMessageKey
  readonly error: RoomUiError | null
  readonly diagnostics: ConferenceDiagnostics | null
  readonly activePanel: RoomPanel | null
  readonly pinnedTileId: string | null
  readonly settingsOpen: boolean
  readonly speakingParticipantIds: readonly string[]
  readonly chat: RoomChatState
}

export type RoomUiAction =
  | { readonly type: 'room-opened'; readonly roomId: string }
  | { readonly type: 'go-home-pressed' }
  | { readonly type: 'prejoin-completed' }
  | { readonly type: 'microphone-toggled' }
  | { readonly type: 'camera-toggled' }
  | { readonly type: 'screen-share-toggled' }
  | { readonly type: 'copy-link-pressed' }
  | { readonly type: 'export-logs-pressed' }
  | { readonly type: 'clear-logs-pressed' }
  | { readonly type: 'leave-pressed' }
  | { readonly type: 'panel-toggled'; readonly panel: RoomPanel }
  | { readonly type: 'panel-closed' }
  | { readonly type: 'tile-pin-toggled'; readonly tileId: string }
  | { readonly type: 'settings-opened' }
  | { readonly type: 'settings-closed' }
  | { readonly type: 'chat-draft-changed'; readonly value: string }
  | { readonly type: 'chat-message-sent' }
  | { readonly type: 'chat-latest-visible' }
  | { readonly type: 'chat-file-selected'; readonly file: File }
  | { readonly type: 'chat-reaction-toggled'; readonly messageId: string; readonly emoji: string }
  | { readonly type: 'chat-reply-started'; readonly messageId: string }
  | { readonly type: 'chat-reply-preview-pressed'; readonly messageId: string }
  | { readonly type: 'chat-reply-cancelled' }
  | { readonly type: 'chat-edit-started'; readonly messageId: string }
  | { readonly type: 'chat-edit-cancelled' }
  | { readonly type: 'chat-edit-draft-changed'; readonly value: string }
  | { readonly type: 'chat-edit-submitted'; readonly messageId: string }
  | { readonly type: 'chat-message-deleted'; readonly messageId: string }

export type RoomUiEffect =
  | { readonly type: 'navigate-home' }
  | { readonly type: 'show-toast'; readonly message: RoomToastMessageKey }
  | { readonly type: 'download-logs'; readonly fileName: string; readonly content: string }

export type RoomUiError = {
  readonly title: RoomErrorMessageKey
  readonly description: RoomErrorMessageKey
  readonly actionLabel: RoomErrorMessageKey
}

export const initialRoomState: RoomUiState = {
  roomId: '',
  prejoinOpen: false,
  status: 'idle',
  participants: [],
  localParticipantId: null,
  localMediaStreams: {},
  remoteMediaStreams: {},
  microphone: { kind: 'microphone', enabled: true, loading: false, error: null },
  camera: { kind: 'camera', enabled: false, loading: false, error: null },
  screenShare: { kind: 'screen', enabled: false, loading: false, error: null },
  actionStatus: 'room.status.chooseSettings',
  error: null,
  diagnostics: null,
  activePanel: null,
  pinnedTileId: null,
  settingsOpen: false,
  speakingParticipantIds: [],
  chat: {
    status: 'idle',
    open: false,
    draft: '',
    messages: [],
    pendingAttachments: [],
    unreadCount: 0,
    lastReadMessageId: null,
    replyToId: null,
    editingMessageId: null,
    editingDraft: '',
    highlightedMessageId: null,
    error: null
  }
}
