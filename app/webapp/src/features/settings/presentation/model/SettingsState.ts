import type { LocalPreviewState, MediaDevice } from '@capabilities/media/domain/model'
import type { UserSettings } from '@capabilities/user-preferences/domain/model/UserSettings'
import type { PrefixedTranslationKey } from '@core/i18n/translation-key'

export type SettingsTab = 'profile' | 'media' | 'appearance'
export type SettingsErrorMessageKey = PrefixedTranslationKey<'common', 'settings.errors'>

export type SettingsUiState = {
  readonly activeTab: SettingsTab
  readonly loading: boolean
  readonly devices: readonly MediaDevice[]
  readonly displayName: string
  readonly micEnabled: boolean
  readonly cameraEnabled: boolean
  readonly selectedMicrophoneId: string | null
  readonly selectedCameraId: string | null
  readonly preview: LocalPreviewState | null
  readonly error: SettingsErrorMessageKey | null
}

export type SettingsUiAction =
  | { readonly type: 'opened' }
  | { readonly type: 'closed' }
  | { readonly type: 'tab-selected'; readonly tab: SettingsTab }
  | { readonly type: 'display-name-changed'; readonly value: string }
  | { readonly type: 'microphone-toggled'; readonly enabled: boolean }
  | { readonly type: 'camera-toggled'; readonly enabled: boolean }
  | { readonly type: 'microphone-selected'; readonly deviceId: string | null }
  | { readonly type: 'camera-selected'; readonly deviceId: string | null }

export type SettingsUiEffect = {
  readonly type: 'show-error'
  readonly message: SettingsErrorMessageKey
}

export const initialSettingsState: SettingsUiState = {
  activeTab: 'profile',
  loading: false,
  devices: [],
  displayName: '',
  micEnabled: true,
  cameraEnabled: false,
  selectedMicrophoneId: null,
  selectedCameraId: null,
  preview: null,
  error: null
}

export function applyUserSettings(state: SettingsUiState, settings: UserSettings): SettingsUiState {
  return {
    ...state,
    displayName: settings.displayName ?? '',
    micEnabled: settings.defaultMicEnabled,
    cameraEnabled: settings.defaultCameraEnabled,
    selectedMicrophoneId: settings.preferredMicrophoneId,
    selectedCameraId: settings.preferredCameraId
  }
}
