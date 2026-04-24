import { MutableSharedFlow, MutableStateFlow, ViewModel } from '@kvt/core'
import {
  initialPrejoinState,
  type PrejoinUiAction,
  type PrejoinUiEffect,
  type PrejoinUiState,
  type PrejoinErrorMessageKey
} from '../model/PrejoinState'
import type { JoinRoomFlowUseCase } from '@features/prejoin/domain/usecases/JoinRoomFlowUseCase'
import type { LoadPrejoinContextUseCase } from '@features/prejoin/domain/usecases/LoadPrejoinContextUseCase'
import type { StartPrejoinPreviewUseCase } from '@features/prejoin/domain/usecases/StartPrejoinPreviewUseCase'
import type { ObserveLocalMediaUseCase } from '@capabilities/media/domain/usecases/ObserveLocalMediaUseCase'
import type { SetMicrophoneEnabledUseCase } from '@capabilities/media/domain/usecases/SetMicrophoneEnabledUseCase'
import type { SetCameraEnabledUseCase } from '@capabilities/media/domain/usecases/SetCameraEnabledUseCase'

export class PrejoinViewModel extends ViewModel {
  private readonly state = new MutableStateFlow<PrejoinUiState>(initialPrejoinState)
  private readonly effects = new MutableSharedFlow<PrejoinUiEffect>()

  readonly uiState = this.state.asStateFlow()
  readonly uiEffect = this.effects.asSharedFlow()

  constructor(
    private readonly loadPrejoinContextUseCase: LoadPrejoinContextUseCase,
    private readonly startPrejoinPreviewUseCase: StartPrejoinPreviewUseCase,
    private readonly observeLocalMediaUseCase: ObserveLocalMediaUseCase,
    private readonly setMicrophoneEnabledUseCase: SetMicrophoneEnabledUseCase,
    private readonly setCameraEnabledUseCase: SetCameraEnabledUseCase,
    private readonly joinRoomFlowUseCase: JoinRoomFlowUseCase
  ) {
    super()
  }

  protected override onInit() {
    return this.observeLocalMediaUseCase.execute().subscribe((media) => {
      this.state.update((state) => ({ ...state, preview: media.preview }))
    })
  }

  onEvent(event: PrejoinUiAction) {
    switch (event.type) {
      case 'room-configured':
        void this.configureRoom(event.roomId, event.role)
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
        this.state.update((state) => ({ ...state, selectedMicrophoneId: event.deviceId }))
        break
      case 'camera-selected':
        this.state.update((state) => ({ ...state, selectedCameraId: event.deviceId }))
        break
      case 'join-pressed':
        void this.join()
        break
      default:
        throw new Error(`Unknown event: ${JSON.stringify(event)}`)
    }
  }

  private async configureRoom(roomId: string, role: PrejoinUiState['role']) {
    if (this.state.value.roomId === roomId && this.state.value.role === role) {
      return
    }

    this.state.update((state) => ({
      ...state,
      roomId,
      role,
      loading: true,
      error: null
    }))

    const context = await this.loadPrejoinContextUseCase.execute({ roomId, requestedRole: role })
    if (!context.ok) {
      const message = prejoinContextErrorMessage(context.error.type)
      this.state.update((state) => ({
        ...state,
        loading: false,
        error: message
      }))
      this.effects.emit({ type: 'load-failed', message })
      return
    }

    const preferences = context.value.preferences
    this.state.update((state) => ({
      ...state,
      loading: false,
      devices: context.value.devices,
      role,
      displayName: {
        value: preferences.displayName ?? '',
        error: null,
        showError: false
      },
      micEnabled: preferences.defaultMicEnabled,
      cameraEnabled: preferences.defaultCameraEnabled,
      selectedMicrophoneId: preferences.preferredMicrophoneId,
      selectedCameraId: preferences.preferredCameraId,
      joinButton: {
        ...state.joinButton,
        enabled: Boolean(preferences.displayName?.trim())
      }
    }))

    await this.startPreview()
  }

  private updateDisplayName(value: string) {
    const trimmed = value.trim()
    this.state.update((state) => ({
      ...state,
      displayName: {
        value,
        error: trimmed ? null : 'prejoin.errors.nameRequired',
        showError: state.displayName.showError && !trimmed
      },
      joinButton: {
        ...state.joinButton,
        enabled: trimmed.length > 0
      }
    }))
  }

  private async updateMicrophone(enabled: boolean) {
    this.state.update((state) => ({
      ...state,
      micEnabled: enabled,
      preview: state.preview ? { ...state.preview, micEnabled: enabled } : state.preview
    }))

    const result = await this.setMicrophoneEnabledUseCase.execute(enabled)
    if (!result.ok) {
      const message = mediaErrorMessage(result.error.type)
      this.state.update((state) => ({
        ...state,
        error: message,
        micEnabled: !enabled,
        preview: state.preview ? { ...state.preview, micEnabled: !enabled } : state.preview
      }))
      this.effects.emit({ type: 'preview-failed', message })
    }
  }

  private async updateCamera(enabled: boolean) {
    this.state.update((state) => ({
      ...state,
      cameraEnabled: enabled,
      preview: state.preview
        ? {
            ...state.preview,
            cameraEnabled: enabled,
            previewAvailable: enabled,
            status: enabled ? 'ready' : 'idle'
          }
        : state.preview
    }))

    const result = await this.setCameraEnabledUseCase.execute(enabled)
    if (!result.ok) {
      const message = mediaErrorMessage(result.error.type)
      this.state.update((state) => ({
        ...state,
        error: message,
        cameraEnabled: !enabled,
        preview: state.preview
          ? {
              ...state.preview,
              cameraEnabled: !enabled,
              previewAvailable: !enabled ? state.preview.previewAvailable : false,
              status: !enabled ? state.preview.status : 'idle'
            }
          : state.preview
      }))
      this.effects.emit({ type: 'preview-failed', message })
    }
  }

  private async join() {
    const state = this.state.value
    const displayName = state.displayName.value.trim()

    if (!displayName) {
      this.state.update((current) => ({
        ...current,
        displayName: {
          ...current.displayName,
          error: 'prejoin.errors.nameRequired',
          showError: true
        }
      }))
      this.effects.emit({ type: 'join-failed', message: 'prejoin.errors.enterName' })
      return
    }

    this.state.update((current) => ({
      ...current,
      error: null,
      joinButton: { ...current.joinButton, loading: true, enabled: false }
    }))

    const result = await this.joinRoomFlowUseCase.execute({
      roomId: state.roomId,
      displayName,
      micEnabled: state.micEnabled,
      cameraEnabled: state.cameraEnabled,
      microphoneDeviceId: state.selectedMicrophoneId,
      cameraDeviceId: state.selectedCameraId,
      role: state.role
    })

    this.state.update((current) => ({
      ...current,
      joinButton: { ...current.joinButton, loading: false, enabled: true }
    }))

    if (result.ok) {
      this.effects.emit({ type: 'joined', roomId: result.value.session.roomId })
    } else {
      const message = prejoinJoinErrorMessage(result.error.type)
      this.state.update((current) => ({ ...current, error: message }))
      this.effects.emit({ type: 'join-failed', message })
    }
  }

  private async startPreview() {
    const state = this.state.value
    const result = await this.startPrejoinPreviewUseCase.execute({
      displayName: state.displayName.value,
      micEnabled: state.micEnabled,
      cameraEnabled: state.cameraEnabled,
      microphoneDeviceId: state.selectedMicrophoneId,
      cameraDeviceId: state.selectedCameraId,
      noiseSuppressionEnabled: true
    })

    if (!result.ok) {
      const message = mediaErrorMessage(result.error.type)
      this.state.update((current) => ({
        ...current,
        error: message,
        joinButton: {
          ...current.joinButton,
          enabled:
            !current.micEnabled &&
            !current.cameraEnabled &&
            current.displayName.value.trim().length > 0
        }
      }))
      this.effects.emit({ type: 'preview-failed', message })
      return
    }

    this.state.update((current) => ({
      ...current,
      error: null,
      joinButton: {
        ...current.joinButton,
        enabled: current.displayName.value.trim().length > 0
      }
    }))
  }
}

function prejoinContextErrorMessage(
  error: 'room-not-found' | 'media-unavailable' | 'unknown-error'
): PrejoinErrorMessageKey {
  switch (error) {
    case 'room-not-found':
      return 'prejoin.errors.roomNotFound'
    case 'media-unavailable':
      return 'prejoin.errors.mediaUnavailable'
    default:
      return 'prejoin.errors.load'
  }
}

function mediaErrorMessage(
  error:
    | 'permission-denied'
    | 'device-not-found'
    | 'device-busy'
    | 'insecure-context'
    | 'api-unavailable'
    | 'unknown-error'
): PrejoinErrorMessageKey {
  switch (error) {
    case 'permission-denied':
      return 'prejoin.errors.permissionDenied'
    case 'device-not-found':
      return 'prejoin.errors.deviceNotFound'
    case 'device-busy':
      return 'prejoin.errors.deviceBusy'
    case 'insecure-context':
      return 'prejoin.errors.insecureContext'
    case 'api-unavailable':
      return 'prejoin.errors.apiUnavailable'
    default:
      return 'prejoin.errors.preview'
  }
}

function prejoinJoinErrorMessage(
  error:
    | 'display-name-empty'
    | 'room-not-found'
    | 'join-failed'
    | 'preferences-save-failed'
    | 'unknown-error'
): PrejoinErrorMessageKey {
  switch (error) {
    case 'display-name-empty':
      return 'prejoin.errors.enterName'
    case 'room-not-found':
      return 'prejoin.errors.roomNotFound'
    default:
      return 'prejoin.errors.join'
  }
}
