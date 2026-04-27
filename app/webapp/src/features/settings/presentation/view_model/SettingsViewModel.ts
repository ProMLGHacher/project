import { CompositeDisposable, MutableSharedFlow, MutableStateFlow, ViewModel } from '@kvt/core'
import type { MediaError } from '@capabilities/media/domain/model'
import type { GetUserPreferencesUseCase } from '@capabilities/user-preferences/domain/usecases/GetUserPreferencesUseCase'
import type { SaveDefaultCameraEnabledUseCase } from '@capabilities/user-preferences/domain/usecases/SaveDefaultCameraEnabledUseCase'
import type { SaveDefaultMicEnabledUseCase } from '@capabilities/user-preferences/domain/usecases/SaveDefaultMicEnabledUseCase'
import type { SaveDisplayNameUseCase } from '@capabilities/user-preferences/domain/usecases/SaveDisplayNameUseCase'
import type { SavePreferredCameraUseCase } from '@capabilities/user-preferences/domain/usecases/SavePreferredCameraUseCase'
import type { SavePreferredMicrophoneUseCase } from '@capabilities/user-preferences/domain/usecases/SavePreferredMicrophoneUseCase'
import type { ListMediaDevicesUseCase } from '@capabilities/media/domain/usecases/ListMediaDevicesUseCase'
import type { ObserveLocalMediaUseCase } from '@capabilities/media/domain/usecases/ObserveLocalMediaUseCase'
import type { SetCameraEnabledUseCase } from '@capabilities/media/domain/usecases/SetCameraEnabledUseCase'
import type { SetMicrophoneEnabledUseCase } from '@capabilities/media/domain/usecases/SetMicrophoneEnabledUseCase'
import type { StartLocalPreviewUseCase } from '@capabilities/media/domain/usecases/StartLocalPreviewUseCase'
import type { StopLocalPreviewUseCase } from '@capabilities/media/domain/usecases/StopLocalPreviewUseCase'
import {
  applyUserSettings,
  initialSettingsState,
  type SettingsTab,
  type SettingsErrorMessageKey,
  type SettingsUiAction,
  type SettingsUiEffect,
  type SettingsUiState
} from '../model/SettingsState'

export class SettingsViewModel extends ViewModel {
  private readonly state = new MutableStateFlow<SettingsUiState>(initialSettingsState)
  private readonly effects = new MutableSharedFlow<SettingsUiEffect>()

  private previewRequestId = 0

  readonly uiState = this.state.asStateFlow()
  readonly uiEffect = this.effects.asSharedFlow()

  constructor(
    private readonly getUserPreferencesUseCase: GetUserPreferencesUseCase,
    private readonly listMediaDevicesUseCase: ListMediaDevicesUseCase,
    private readonly observeLocalMediaUseCase: ObserveLocalMediaUseCase,
    private readonly startLocalPreviewUseCase: StartLocalPreviewUseCase,
    private readonly stopLocalPreviewUseCase: StopLocalPreviewUseCase,
    private readonly setMicrophoneEnabledUseCase: SetMicrophoneEnabledUseCase,
    private readonly setCameraEnabledUseCase: SetCameraEnabledUseCase,
    private readonly saveDisplayNameUseCase: SaveDisplayNameUseCase,
    private readonly saveDefaultMicEnabledUseCase: SaveDefaultMicEnabledUseCase,
    private readonly saveDefaultCameraEnabledUseCase: SaveDefaultCameraEnabledUseCase,
    private readonly savePreferredMicrophoneUseCase: SavePreferredMicrophoneUseCase,
    private readonly savePreferredCameraUseCase: SavePreferredCameraUseCase
  ) {
    super()
  }

  protected override onInit() {
    const disposables = new CompositeDisposable()

    disposables.add(
      this.observeLocalMediaUseCase.execute().subscribe((media) => {
        this.updateState((state) => ({
          ...state,
          preview: media.preview
        }))
      })
    )

    return disposables
  }

  onEvent(event: SettingsUiAction) {
    switch (event.type) {
      case 'opened':
        void this.open()
        break
      case 'closed':
        this.close()
        break
      case 'tab-selected':
        void this.selectTab(event.tab)
        break
      case 'display-name-changed':
        this.updateDisplayName(event.value)
        break
      case 'microphone-toggled':
        void this.updateMicrophone(event.enabled)
        break
      case 'camera-toggled':
        void this.updateCamera(event.enabled)
        break
      case 'microphone-selected':
        void this.selectMicrophone(event.deviceId)
        break
      case 'camera-selected':
        void this.selectCamera(event.deviceId)
        break
      default:
        throw new Error(`Unknown event: ${JSON.stringify(event)}`)
    }
  }

  private async open() {
    this.updateState((state) => ({
      ...state,
      loading: true,
      error: null
    }))

    const [preferences, devices] = await Promise.all([
      this.getUserPreferencesUseCase.execute(),
      this.listMediaDevicesUseCase.execute()
    ])

    this.updateState((state) => ({
      ...applyUserSettings(state, preferences),
      devices: devices.ok ? devices.value : [],
      loading: false,
      error: devices.ok ? null : settingsMediaErrorMessage(devices.error)
    }))

    if (!devices.ok) {
      this.effects.emit({ type: 'show-error', message: settingsMediaErrorMessage(devices.error) })
    }
  }

  private close() {
    this.previewRequestId++
    this.stopLocalPreviewUseCase.execute()
    this.updateState((state) => ({
      ...state,
      activeTab: 'profile',
      preview: null
    }))
  }

  private async selectTab(tab: SettingsTab) {
    this.updateState((state) => ({ ...state, activeTab: tab }))

    if (tab === 'media') {
      await this.startPreview()
      return
    }

    this.previewRequestId++
    this.stopLocalPreviewUseCase.execute()
  }

  private updateDisplayName(value: string) {
    this.updateState((state) => ({ ...state, displayName: value }))
    this.saveDisplayNameUseCase.execute(value.trim())
  }

  private async updateMicrophone(enabled: boolean) {
    this.updateState((state) => ({ ...state, micEnabled: enabled }))
    this.saveDefaultMicEnabledUseCase.execute(enabled)

    const result = await this.setMicrophoneEnabledUseCase.execute(enabled)
    if (!result.ok) {
      this.handleMediaError(result.error)
    }
  }

  private async updateCamera(enabled: boolean) {
    this.updateState((state) => ({ ...state, cameraEnabled: enabled }))
    this.saveDefaultCameraEnabledUseCase.execute(enabled)

    const result = await this.setCameraEnabledUseCase.execute(enabled)
    if (!result.ok) {
      this.handleMediaError(result.error)
    }
  }

  private async selectMicrophone(deviceId: string | null) {
    this.updateState((state) => ({ ...state, selectedMicrophoneId: deviceId }))
    this.savePreferredMicrophoneUseCase.execute(deviceId)
    if (this.state.value.activeTab === 'media') {
      await this.startPreview()
    }
  }

  private async selectCamera(deviceId: string | null) {
    this.updateState((state) => ({ ...state, selectedCameraId: deviceId }))
    this.savePreferredCameraUseCase.execute(deviceId)
    if (this.state.value.activeTab === 'media') {
      await this.startPreview()
    }
  }

  private async startPreview() {
    const requestId = ++this.previewRequestId
    const state = this.state.value

    const result = await this.startLocalPreviewUseCase.execute({
      micEnabled: state.micEnabled,
      cameraEnabled: state.cameraEnabled,
      microphoneDeviceId: state.selectedMicrophoneId,
      cameraDeviceId: state.selectedCameraId
    })

    if (requestId !== this.previewRequestId || result.ok) {
      return
    }

    this.handleMediaError(result.error)
  }

  private handleMediaError(error: MediaError) {
    const message = settingsMediaErrorMessage(error)
    this.updateState((state) => ({
      ...state,
      error: message
    }))
    this.effects.emit({ type: 'show-error', message })
  }

  private updateState(updater: (state: SettingsUiState) => SettingsUiState) {
    this.state.update(updater)
  }
}

function settingsMediaErrorMessage(error: MediaError): SettingsErrorMessageKey {
  switch (error.type) {
    case 'permission-denied':
      return 'settings.errors.permissionDenied'
    case 'device-not-found':
      return 'settings.errors.deviceNotFound'
    case 'device-busy':
      return 'settings.errors.deviceBusy'
    case 'insecure-context':
      return 'settings.errors.insecureContext'
    case 'api-unavailable':
      return 'settings.errors.apiUnavailable'
    case 'unknown-error':
      return 'settings.errors.preview'
  }
}

export type { SettingsTab }
