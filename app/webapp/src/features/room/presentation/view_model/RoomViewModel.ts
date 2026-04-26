import { CompositeDisposable, MutableSharedFlow, MutableStateFlow, ViewModel } from '@kvt/core'
import type { Participant } from '@features/room/domain/model/Participant'
import type { RtcDiagnostics, RtcSession } from '@capabilities/rtc/domain/model'
import type { ConnectToRoomRtcUseCase } from '@capabilities/rtc/domain/usecases/ConnectToRoomRtcUseCase'
import type { LoadJoinSessionUseCase } from '@capabilities/session/domain/usecases/LoadJoinSessionUseCase'
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

  // Нужны, чтобы старые async-ответы не перезаписывали новое состояние.
  private openRoomRequestId = 0
  private enterRoomRequestId = 0
  private connectRoomRequestId = 0
  private microphoneRequestId = 0
  private cameraRequestId = 0
  private screenShareRequestId = 0

  readonly uiState = this.state.asStateFlow()
  readonly uiEffect = this.effects.asSharedFlow()

  constructor(
    private readonly loadJoinSessionUseCase: LoadJoinSessionUseCase,
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
    private readonly leaveRoomUseCase: LeaveRoomUseCase
  ) {
    super()
  }

  protected override onInit() {
    const disposables = new CompositeDisposable()

    disposables.add(
      this.observeRoomSessionUseCase.execute().subscribe((session) => {
        this.updateState((state) => this.applyObservedSession(state, session))
      })
    )

    disposables.add(
      this.observeRoomDiagnosticsUseCase.execute().subscribe((diagnostics) => {
        this.latestDiagnostics = diagnostics

        this.updateState((state) => this.withDiagnostics(state, null))
      })
    )

    return disposables
  }

  onEvent(event: RoomUiAction) {
    switch (event.type) {
      case 'room-opened':
        void this.openRoom(event.roomId)
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
      case 'technical-info-toggled':
        this.updateState((state) => ({ ...state, technicalInfoVisible: event.visible }))
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

    if (current.roomId === normalizedRoomId && current.status !== 'failed' && !current.error) {
      return
    }

    const requestId = ++this.openRoomRequestId

    // Смена комнаты делает неактуальными старые подключения и pending-toggle операции.
    this.enterRoomRequestId++
    this.connectRoomRequestId++
    this.invalidateControlRequests()
    this.latestDiagnostics = null

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
    const requestId = ++this.enterRoomRequestId
    const roomId = this.state.value.roomId

    const storedSession = await this.loadJoinSessionUseCase.execute(roomId)

    if (!this.isActualEnterRoomRequest(requestId) || this.state.value.roomId !== roomId) {
      return
    }

    if (!storedSession.ok) {
      this.effects.emit({ type: 'show-toast', message: 'room.toasts.sessionMissing' })
      return
    }

    await this.connectStoredSession(storedSession.value)
  }

  private async toggleMicrophone() {
    await this.toggleRoomControl({
      control: 'microphone',
      slotKind: 'audio',
      failedToast: 'room.toasts.microphoneFailed',
      enabledStatus: 'room.status.microphoneOn',
      disabledStatus: 'room.status.microphoneMuted',
      getPublishing: () => true,
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

  private async connectStoredSession(session: StoredJoinSession, openRoomRequestId?: number) {
    const requestId = ++this.connectRoomRequestId

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
      iceServers: session.iceServers,
      micEnabled: hasEnabledSlot(session.snapshot.participants, session.participantId, 'audio'),
      cameraEnabled: hasEnabledSlot(session.snapshot.participants, session.participantId, 'camera')
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

      this.effects.emit({ type: 'show-toast', message: 'room.toasts.sessionExpired' })

      this.updateState((state) => ({
        ...state,
        status: 'idle',
        prejoinOpen: true,
        participants: [],
        localParticipantId: null,
        localStream: null,
        remoteStreams: {},
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

      return
    }

    this.updateState((state) => ({
      ...state,
      participants: session.snapshot.participants as Participant[],
      localParticipantId: session.participantId,
      localStream: state.localStream,
      remoteStreams: state.remoteStreams,
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
  }

  private async leaveRoom() {
    const roomId = this.state.value.roomId

    this.openRoomRequestId++
    this.enterRoomRequestId++
    this.connectRoomRequestId++
    this.invalidateControlRequests()
    this.latestDiagnostics = null

    this.leaveRoomUseCase.execute()
    await this.clearJoinSessionUseCase.execute(roomId)

    this.effects.emit({ type: 'navigate-home' })
  }

  private applyObservedSession(state: RoomUiState, session: RtcSession): RoomUiState {
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
      localStream: session.localStream,
      remoteStreams: session.remoteStreams
    }

    // Если RTC-сессия прислала новый snapshot, UI-контролы лучше синхронизировать с ним.
    return this.withDiagnostics(this.syncControlsWithLocalParticipant(nextState), session)
  }

  private createOpeningRoomState(state: RoomUiState, roomId: string): RoomUiState {
    return {
      ...state,
      roomId,
      prejoinOpen: false,
      status: 'connecting',
      participants: [],
      localParticipantId: null,
      localStream: null,
      remoteStreams: {},
      error: null,
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
        enabled: participantHasEnabledSlot(localParticipant, 'audio')
      },
      camera: {
        ...state.camera,
        enabled: participantHasEnabledSlot(localParticipant, 'camera')
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
        return ++this.microphoneRequestId
      case 'camera':
        return ++this.cameraRequestId
      case 'screenShare':
        return ++this.screenShareRequestId
    }
  }

  private isActualControlRequest(control: RoomControlKey, requestId: number): boolean {
    switch (control) {
      case 'microphone':
        return requestId === this.microphoneRequestId
      case 'camera':
        return requestId === this.cameraRequestId
      case 'screenShare':
        return requestId === this.screenShareRequestId
    }
  }

  private invalidateControlRequests() {
    this.microphoneRequestId++
    this.cameraRequestId++
    this.screenShareRequestId++
  }

  private isActualOpenRoomRequest(requestId: number): boolean {
    return requestId === this.openRoomRequestId
  }

  private isActualEnterRoomRequest(requestId: number): boolean {
    return requestId === this.enterRoomRequestId
  }

  private isActualConnectRoomRequest(requestId: number): boolean {
    return requestId === this.connectRoomRequestId
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

function createDiagnostics(
  state: RoomUiState,
  session: RtcSession | null,
  rtcDiagnostics: RtcDiagnostics | null
): RoomUiState['diagnostics'] {
  const nextSession = session ?? null
  const roomId = nextSession?.roomId || state.roomId || 'not selected'
  const participants = nextSession?.snapshot?.participants ?? state.participants
  const localStream = nextSession?.localStream ?? state.localStream
  const remoteStreams = nextSession?.remoteStreams ?? state.remoteStreams
  const diagnostics = rtcDiagnostics

  return {
    room: [
      `Room id: ${roomId}`,
      `Participants: ${participants.length}`,
      `Local participant: ${nextSession?.participantId || state.localParticipantId || 'missing'}`,
      `Remote streams: ${Object.keys(remoteStreams).length}`
    ],
    publisher: [
      `Connection: ${diagnostics?.publisherConnectionState ?? state.status}`,
      `ICE: ${diagnostics?.publisherIceState ?? 'unknown'}`,
      `Local tracks: ${describeStreamTracks(localStream)}`
    ],
    subscriber: [
      `Connection: ${diagnostics?.subscriberConnectionState ?? 'unknown'}`,
      `ICE: ${diagnostics?.subscriberIceState ?? 'unknown'}`,
      `Remote streams: ${Object.keys(remoteStreams).length}`
    ],
    signaling: [
      `Socket: ${diagnostics?.signalingState ?? 'unknown'}`,
      `Sent: ${formatSignals(diagnostics?.recentSignalsSent)}`,
      `Received: ${formatSignals(diagnostics?.recentSignalsReceived)}`,
      `Last error: ${diagnostics?.lastError ?? 'none'}`
    ]
  }
}

function describeStreamTracks(stream: MediaStream | null): string {
  if (!stream) {
    return 'none'
  }

  const audio = stream.getAudioTracks().filter((track) => track.readyState === 'live').length
  const video = stream.getVideoTracks().filter((track) => track.readyState === 'live').length

  return `audio=${audio}, video=${video}`
}

function formatSignals(signals: readonly string[] | undefined): string {
  if (!signals?.length) {
    return 'none'
  }

  return signals.slice(-6).join(', ')
}

function updateLocalSlot(
  state: RoomUiState,
  kind: ParticipantSlotKind,
  enabled: boolean,
  publishing: boolean
): readonly Participant[] {
  return state.participants.map((participant) => {
    if (participant.id !== state.localParticipantId) {
      return participant
    }

    return {
      ...participant,
      slots: participant.slots.map((slot) =>
        slot.kind === kind
          ? {
              ...slot,
              enabled,
              publishing,
              trackBound: publishing,
              revision: slot.revision + 1
            }
          : slot
      )
    }
  })
}

function hasEnabledSlot(
  participants: readonly Participant[],
  participantId: string,
  kind: ParticipantSlotKind
): boolean {
  return (
    participants
      .find((participant) => participant.id === participantId)
      ?.slots.some((slot) => slot.kind === kind && slot.enabled) ?? false
  )
}

function participantHasEnabledSlot(participant: Participant, kind: ParticipantSlotKind): boolean {
  return participant.slots.some((slot) => slot.kind === kind && slot.enabled)
}
