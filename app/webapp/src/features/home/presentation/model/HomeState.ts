import type { ButtonState } from '@core/utils/ButtonState'
import type { FormFieldStateWithShowError } from '@core/utils/FormFieldState'
import type { PrefixedTranslationKey } from '@core/i18n/translation-key'
import type { RecentRoom } from '../../domain/model/RecentRoom'

export type HomeErrorMessageKey = PrefixedTranslationKey<'voice', 'home.errors'>
export type HomeToastMessageKey = Extract<HomeErrorMessageKey, 'home.errors.createRoom'>

export type HomeUiState = {
  readonly idOrLinkToJoinState: FormFieldStateWithShowError<string, HomeErrorMessageKey>
  readonly joinButtonState: ButtonState
  readonly createRoomButtonState: ButtonState
  readonly recentRooms: readonly RecentRoom[]
  readonly feedback: HomeErrorMessageKey | null
}

export type HomeUiAction =
  | { readonly type: 'id-or-link-to-join-changed'; readonly value: string }
  | { readonly type: 'join-pressed' }
  | { readonly type: 'recent-room-pressed'; readonly roomId: string }
  | { readonly type: 'create-room-pressed' }

export type HomeUiEffect =
  | { readonly type: 'open-room'; readonly roomId: string }
  | { readonly type: 'show-message'; readonly message: HomeToastMessageKey }

export const initialHomeState: HomeUiState = {
  idOrLinkToJoinState: { value: '', error: null, showError: false },
  joinButtonState: { enabled: false, loading: false, error: null },
  createRoomButtonState: { enabled: true, loading: false, error: null },
  recentRooms: [],
  feedback: null
}
