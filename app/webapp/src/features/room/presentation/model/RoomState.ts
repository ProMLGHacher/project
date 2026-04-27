import type { ConferenceDiagnostics } from '@features/room/presentation/model/RoomDiagnostics'
import type { RoomControlState } from '@features/room/domain/model/RoomControls'
import type { Participant } from '@features/room/domain/model/Participant'
import type { RtcConnectionStatus, RtcMediaStreams } from '@capabilities/rtc/domain/model'
import type { PrefixedTranslationKey } from '@core/i18n/translation-key'

export type RoomStatusMessageKey = PrefixedTranslationKey<'voice', 'room.status'>
export type RoomToastMessageKey = PrefixedTranslationKey<'voice', 'room.toasts'>
export type RoomErrorMessageKey = PrefixedTranslationKey<'voice', 'room.errors'>
export type RoomPanel = 'participants' | 'roomInfo' | 'techInfo'

export type RoomUiState = {
  readonly roomId: string
  readonly prejoinOpen: boolean
  readonly status: RtcConnectionStatus
  readonly participants: readonly Participant[]
  readonly localParticipantId: string | null
  readonly localStream: MediaStream | null
  readonly localMediaStreams: RtcMediaStreams
  readonly remoteStreams: Readonly<Record<string, MediaStream>>
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
  localStream: null,
  localMediaStreams: {},
  remoteStreams: {},
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
  speakingParticipantIds: []
}
