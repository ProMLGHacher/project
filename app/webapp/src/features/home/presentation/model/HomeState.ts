import type { ButtonState } from '@core/utils/ButtonState'
import type { FormFieldStateWithShowError } from '@core/utils/FormFieldState'
import type { PrefixedTranslationKey } from '@core/i18n/translation-key'
import type { RecentRoom } from '../../domain/model/RecentRoom'
import type { ChatConnectionStatus, ChatMessage } from '@capabilities/chat/domain/model/Chat'

export type HomeErrorMessageKey = PrefixedTranslationKey<'voice', 'home.errors'>
export type HomeToastMessageKey = Extract<HomeErrorMessageKey, 'home.errors.createRoom'>

export type HomeUiState = {
  readonly idOrLinkToJoinState: FormFieldStateWithShowError<string, HomeErrorMessageKey>
  readonly joinButtonState: ButtonState
  readonly createRoomButtonState: ButtonState
  readonly recentRooms: readonly RecentRoom[]
  readonly chatDrawer: HomeChatDrawerState
  readonly feedback: HomeErrorMessageKey | null
}

export type HomeChatDrawerState = {
  readonly open: boolean
  readonly roomId: string | null
  readonly status: ChatConnectionStatus
  readonly messages: readonly ChatMessage[]
  readonly draft: string
  readonly loading: boolean
  readonly error: string | null
}

export type HomeUiAction =
  | { readonly type: 'id-or-link-to-join-changed'; readonly value: string }
  | { readonly type: 'join-pressed' }
  | { readonly type: 'recent-room-pressed'; readonly roomId: string }
  | { readonly type: 'recent-chat-pressed'; readonly roomId: string }
  | { readonly type: 'chat-drawer-closed' }
  | { readonly type: 'chat-draft-changed'; readonly value: string }
  | { readonly type: 'chat-message-sent' }
  | { readonly type: 'create-room-pressed' }

export type HomeUiEffect =
  | { readonly type: 'open-room'; readonly roomId: string }
  | { readonly type: 'show-message'; readonly message: HomeToastMessageKey }

export const initialHomeState: HomeUiState = {
  idOrLinkToJoinState: { value: '', error: null, showError: false },
  joinButtonState: { enabled: false, loading: false, error: null },
  createRoomButtonState: { enabled: true, loading: false, error: null },
  recentRooms: [],
  chatDrawer: {
    open: false,
    roomId: null,
    status: 'idle',
    messages: [],
    draft: '',
    loading: false,
    error: null
  },
  feedback: null
}
