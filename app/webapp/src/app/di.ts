import {
  Inject,
  Module,
  Provides,
  Singleton,
  ViewModelProvider,
  createModuleFromClass
} from '@kvt/core'
import { BrowserClipboardRepository } from '@capabilities/clipboard/data/repository/BrowserClipboardRepository'
import { clipboardRepositoryToken } from '@capabilities/clipboard/domain/repository/tokens'
import { CopyTextUseCase } from '@capabilities/clipboard/domain/usecases/CopyTextUseCase'
import { BrowserConferenceAudioRepository } from '@capabilities/conference-audio/data/repository/BrowserConferenceAudioRepository'
import { conferenceAudioRepositoryToken } from '@capabilities/conference-audio/domain/repository/tokens'
import { PlayConferenceSoundUseCase } from '@capabilities/conference-audio/domain/usecases/PlayConferenceSoundUseCase'
import { LocalStorageClientLogRepository } from '@capabilities/client-logs/data/repository/LocalStorageClientLogRepository'
import { clientLogRepositoryToken } from '@capabilities/client-logs/domain/repository/tokens'
import { AppendClientLogUseCase } from '@capabilities/client-logs/domain/usecases/AppendClientLogUseCase'
import { ClearClientLogsUseCase } from '@capabilities/client-logs/domain/usecases/ClearClientLogsUseCase'
import { ExportClientLogsUseCase } from '@capabilities/client-logs/domain/usecases/ExportClientLogsUseCase'
import { BrowserLocalPreviewRepository } from '@capabilities/media/data/repository/BrowserLocalPreviewRepository'
import { BrowserScreenShareRepository } from '@capabilities/media/data/repository/BrowserScreenShareRepository'
import { LocalMediaStateStore } from '@capabilities/media/data/repository/LocalMediaStateStore'
import { BrowserMediaDeviceRepository } from '@capabilities/media/data/repository/BrowserMediaDeviceRepository'
import {
  localPreviewRepositoryToken,
  mediaDeviceRepositoryToken,
  screenShareRepositoryToken
} from '@capabilities/media/domain/repository/tokens'
import { ListMediaDevicesUseCase } from '@capabilities/media/domain/usecases/ListMediaDevicesUseCase'
import { ObserveLocalMediaUseCase } from '@capabilities/media/domain/usecases/ObserveLocalMediaUseCase'
import { StartLocalPreviewUseCase } from '@capabilities/media/domain/usecases/StartLocalPreviewUseCase'
import { StopLocalPreviewUseCase } from '@capabilities/media/domain/usecases/StopLocalPreviewUseCase'
import { BrowserRtcRepository } from '@capabilities/rtc/data/repository/BrowserRtcRepository'
import { BrowserSignalingRepository } from '@capabilities/rtc/data/repository/BrowserSignalingRepository'
import {
  rtcRepositoryToken,
  signalingRepositoryToken
} from '@capabilities/rtc/domain/repository/tokens'
import { ConnectToRoomRtcUseCase } from '@capabilities/rtc/domain/usecases/ConnectToRoomRtcUseCase'
import { DecideIceRecoveryUseCase } from '@capabilities/rtc/domain/usecases/DecideIceRecoveryUseCase'
import { DisconnectRtcUseCase } from '@capabilities/rtc/domain/usecases/DisconnectRtcUseCase'
import { RestartIceUseCase } from '@capabilities/rtc/domain/usecases/RestartIceUseCase'
import { SetRtcCameraEnabledUseCase } from '@capabilities/rtc/domain/usecases/SetRtcCameraEnabledUseCase'
import { SetRtcMicrophoneEnabledUseCase } from '@capabilities/rtc/domain/usecases/SetRtcMicrophoneEnabledUseCase'
import { SetRtcScreenShareEnabledUseCase } from '@capabilities/rtc/domain/usecases/SetRtcScreenShareEnabledUseCase'
import { LocalStorageJoinSessionRepository } from '@capabilities/session/data/repository/LocalStorageJoinSessionRepository'
import { joinSessionRepositoryToken } from '@capabilities/session/domain/repository/tokens'
import { ClearJoinSessionUseCase } from '@capabilities/session/domain/usecases/ClearJoinSessionUseCase'
import { LoadJoinSessionUseCase } from '@capabilities/session/domain/usecases/LoadJoinSessionUseCase'
import { SaveJoinSessionUseCase } from '@capabilities/session/domain/usecases/SaveJoinSessionUseCase'
import { LocalStorageUserSettingsRepository } from '@capabilities/user-preferences/data/repository/LocalStorageUserSettingsRepository'
import { userSettingsRepositoryToken } from '@capabilities/user-preferences/domain/repository/tokens'
import { GetUserPreferencesUseCase } from '@capabilities/user-preferences/domain/usecases/GetUserPreferencesUseCase'
import { SaveDefaultCameraEnabledUseCase } from '@capabilities/user-preferences/domain/usecases/SaveDefaultCameraEnabledUseCase'
import { SaveDefaultMicEnabledUseCase } from '@capabilities/user-preferences/domain/usecases/SaveDefaultMicEnabledUseCase'
import { SaveDisplayNameUseCase } from '@capabilities/user-preferences/domain/usecases/SaveDisplayNameUseCase'
import { SavePreferredCameraUseCase } from '@capabilities/user-preferences/domain/usecases/SavePreferredCameraUseCase'
import { SavePreferredMicrophoneUseCase } from '@capabilities/user-preferences/domain/usecases/SavePreferredMicrophoneUseCase'
import { BrowserVoiceActivityRepository } from '@capabilities/voice-activity/data/repository/BrowserVoiceActivityRepository'
import { voiceActivityRepositoryToken } from '@capabilities/voice-activity/domain/repository/tokens'
import { ObserveVoiceActivityUseCase } from '@capabilities/voice-activity/domain/usecases/ObserveVoiceActivityUseCase'
import { StopVoiceActivityUseCase } from '@capabilities/voice-activity/domain/usecases/StopVoiceActivityUseCase'
import { UpdateVoiceActivitySourcesUseCase } from '@capabilities/voice-activity/domain/usecases/UpdateVoiceActivitySourcesUseCase'
import { CreateRoomFlowUseCase } from '@features/home/domain/usecases/CreateRoomFlowUseCase'
import { JoinRoomFlowUseCase as HomeJoinRoomFlowUseCase } from '@features/home/domain/usecases/JoinRoomFlowUseCase'
import { ValidateRoomIdInputUseCase } from '@features/home/domain/usecases/ValidateRoomIdInputUseCase'
import { HomeViewModel } from '@features/home/presentation/view_model/HomeViewModel'
import { JoinRoomFlowUseCase as PrejoinJoinRoomFlowUseCase } from '@features/prejoin/domain/usecases/JoinRoomFlowUseCase'
import { LoadPrejoinContextUseCase } from '@features/prejoin/domain/usecases/LoadPrejoinContextUseCase'
import { StartPrejoinPreviewUseCase } from '@features/prejoin/domain/usecases/StartPrejoinPreviewUseCase'
import { PrejoinViewModel } from '@features/prejoin/presentation/view_model/PrejoinViewModel'
import { HttpRoomRepository } from '@features/room/data/repository/HttpRoomRepository'
import { roomRepositoryToken } from '@features/room/domain/repository/tokens'
import { BuildRoomLinkUseCase } from '@features/room/domain/usecases/BuildRoomLinkUseCase'
import { CopyRoomLinkUseCase } from '@features/room/domain/usecases/CopyRoomLinkUseCase'
import { CreateRoomUseCase } from '@features/room/domain/usecases/CreateRoomUseCase'
import { GetRoomMetadataUseCase } from '@features/room/domain/usecases/GetRoomMetadataUseCase'
import { JoinRoomUseCase } from '@features/room/domain/usecases/JoinRoomUseCase'
import { LeaveRoomUseCase } from '@features/room/domain/usecases/LeaveRoomUseCase'
import { ObserveRoomDiagnosticsUseCase } from '@features/room/domain/usecases/ObserveRoomDiagnosticsUseCase'
import { ObserveRoomSessionUseCase } from '@features/room/domain/usecases/ObserveRoomSessionUseCase'
import { RoomExistsByIdUseCase } from '@features/room/domain/usecases/RoomExistsByIdUseCase'
import { ToggleRoomCameraUseCase } from '@features/room/domain/usecases/ToggleRoomCameraUseCase'
import { ToggleRoomMicrophoneUseCase } from '@features/room/domain/usecases/ToggleRoomMicrophoneUseCase'
import { ToggleRoomScreenShareUseCase } from '@features/room/domain/usecases/ToggleRoomScreenShareUseCase'
import { RoomViewModel } from '@features/room/presentation/view_model/RoomViewModel'
import { SettingsViewModel } from '@features/settings/presentation/view_model/SettingsViewModel'
import type { ClipboardRepository } from '@capabilities/clipboard/domain/repository/ClipboardRepository'
import type { ClientLogRepository } from '@capabilities/client-logs/domain/repository/ClientLogRepository'
import type { ConferenceAudioRepository } from '@capabilities/conference-audio/domain/repository/ConferenceAudioRepository'
import type { LocalPreviewRepository } from '@capabilities/media/domain/repository/LocalPreviewRepository'
import type { ScreenShareRepository } from '@capabilities/media/domain/repository/ScreenShareRepository'
import type { MediaDeviceRepository } from '@capabilities/media/domain/repository/MediaDeviceRepository'
import type { RtcRepository } from '@capabilities/rtc/domain/repository/RtcRepository'
import type { SignalingRepository } from '@capabilities/rtc/domain/repository/SignalingRepository'
import type { JoinSessionRepository } from '@capabilities/session/domain/repository/JoinSessionRepository'
import type { UserSettingsRepository } from '@capabilities/user-preferences/domain/repository/UserSettingsRepository'
import type { VoiceActivityRepository } from '@capabilities/voice-activity/domain/repository/VoiceActivityRepository'
import type { RoomRepository } from '@features/room/domain/repository/RoomRepository'
import { SetCameraEnabledUseCase } from '@capabilities/media/domain/usecases/SetCameraEnabledUseCase'
import { SetMicrophoneEnabledUseCase } from '@capabilities/media/domain/usecases/SetMicrophoneEnabledUseCase'
import { SetNoiseSuppressionUseCase } from '@capabilities/media/domain/usecases/SetNoiseSuppressionUseCase'
import { SetScreenShareEnabledUseCase } from '@capabilities/media/domain/usecases/SetScreenShareEnabledUseCase'

@Module({ name: 'VoiceModule' })
class VoiceModule {
  @Provides(roomRepositoryToken)
  @Singleton({ lazy: true })
  static provideRoomRepository(): RoomRepository {
    return new HttpRoomRepository()
  }

  @Provides(userSettingsRepositoryToken)
  @Singleton({ lazy: true })
  static provideUserSettingsRepository(): UserSettingsRepository {
    return new LocalStorageUserSettingsRepository()
  }

  @Provides(joinSessionRepositoryToken)
  @Singleton({ lazy: true })
  static provideJoinSessionRepository(): JoinSessionRepository {
    return new LocalStorageJoinSessionRepository()
  }

  @Provides(mediaDeviceRepositoryToken)
  @Singleton({ lazy: true })
  static provideMediaDeviceRepository(): MediaDeviceRepository {
    return new BrowserMediaDeviceRepository()
  }

  @Provides(LocalMediaStateStore)
  @Singleton({ lazy: true })
  static provideLocalMediaStateStore(): LocalMediaStateStore {
    return new LocalMediaStateStore()
  }

  @Provides(localPreviewRepositoryToken)
  @Singleton({ lazy: true })
  static provideLocalPreviewRepository(
    @Inject(LocalMediaStateStore) stateStore: LocalMediaStateStore
  ): LocalPreviewRepository {
    return new BrowserLocalPreviewRepository(stateStore)
  }

  @Provides(screenShareRepositoryToken)
  @Singleton({ lazy: true })
  static provideScreenShareRepository(
    @Inject(LocalMediaStateStore) stateStore: LocalMediaStateStore
  ): ScreenShareRepository {
    return new BrowserScreenShareRepository(stateStore)
  }

  @Provides(rtcRepositoryToken)
  @Singleton({ lazy: true })
  static provideRtcRepository(): RtcRepository {
    return new BrowserRtcRepository()
  }

  @Provides(signalingRepositoryToken)
  @Singleton({ lazy: true })
  static provideSignalingRepository(): SignalingRepository {
    return new BrowserSignalingRepository()
  }

  @Provides(clipboardRepositoryToken)
  @Singleton({ lazy: true })
  static provideClipboardRepository(): ClipboardRepository {
    return new BrowserClipboardRepository()
  }

  @Provides(clientLogRepositoryToken)
  @Singleton({ lazy: true })
  static provideClientLogRepository(): ClientLogRepository {
    return new LocalStorageClientLogRepository()
  }

  @Provides(conferenceAudioRepositoryToken)
  @Singleton({ lazy: true })
  static provideConferenceAudioRepository(): ConferenceAudioRepository {
    return new BrowserConferenceAudioRepository()
  }

  @Provides(voiceActivityRepositoryToken)
  @Singleton({ lazy: true })
  static provideVoiceActivityRepository(): VoiceActivityRepository {
    return new BrowserVoiceActivityRepository()
  }

  @Provides(CreateRoomUseCase)
  static provideCreateRoomUseCase(@Inject(roomRepositoryToken) repository: RoomRepository) {
    return new CreateRoomUseCase(repository)
  }

  @Provides(GetRoomMetadataUseCase)
  static provideGetRoomMetadataUseCase(@Inject(roomRepositoryToken) repository: RoomRepository) {
    return new GetRoomMetadataUseCase(repository)
  }

  @Provides(JoinRoomUseCase)
  static provideJoinRoomUseCase(@Inject(roomRepositoryToken) repository: RoomRepository) {
    return new JoinRoomUseCase(repository)
  }

  @Provides(RoomExistsByIdUseCase)
  static provideRoomExistsByIdUseCase(@Inject(roomRepositoryToken) repository: RoomRepository) {
    return new RoomExistsByIdUseCase(repository)
  }

  @Provides(CreateRoomFlowUseCase)
  static provideCreateRoomFlowUseCase(@Inject(CreateRoomUseCase) useCase: CreateRoomUseCase) {
    return new CreateRoomFlowUseCase(useCase)
  }

  @Provides(ValidateRoomIdInputUseCase)
  static provideValidateRoomIdInputUseCase() {
    return new ValidateRoomIdInputUseCase()
  }

  @Provides(HomeJoinRoomFlowUseCase)
  static provideHomeJoinRoomFlowUseCase(
    @Inject(ValidateRoomIdInputUseCase) validate: ValidateRoomIdInputUseCase,
    @Inject(RoomExistsByIdUseCase) exists: RoomExistsByIdUseCase
  ) {
    return new HomeJoinRoomFlowUseCase(validate, exists)
  }

  @Provides(ListMediaDevicesUseCase)
  static provideListMediaDevicesUseCase(
    @Inject(mediaDeviceRepositoryToken) repository: MediaDeviceRepository
  ) {
    return new ListMediaDevicesUseCase(repository)
  }

  @Provides(StartLocalPreviewUseCase)
  static provideStartLocalPreviewUseCase(
    @Inject(localPreviewRepositoryToken) repository: LocalPreviewRepository
  ) {
    return new StartLocalPreviewUseCase(repository)
  }

  @Provides(SetMicrophoneEnabledUseCase)
  static provideSetMicrophoneEnabledUseCase(
    @Inject(localPreviewRepositoryToken) repository: LocalPreviewRepository
  ) {
    return new SetMicrophoneEnabledUseCase(repository)
  }

  @Provides(SetCameraEnabledUseCase)
  static provideSetCameraEnabledUseCase(
    @Inject(localPreviewRepositoryToken) repository: LocalPreviewRepository
  ) {
    return new SetCameraEnabledUseCase(repository)
  }

  @Provides(SetScreenShareEnabledUseCase)
  static provideSetScreenShareEnabledUseCase(
    @Inject(screenShareRepositoryToken) repository: ScreenShareRepository
  ) {
    return new SetScreenShareEnabledUseCase(repository)
  }

  @Provides(SetNoiseSuppressionUseCase)
  static provideSetNoiseSuppressionUseCase(
    @Inject(localPreviewRepositoryToken) repository: LocalPreviewRepository
  ) {
    return new SetNoiseSuppressionUseCase(repository)
  }

  @Provides(ObserveLocalMediaUseCase)
  static provideObserveLocalMediaUseCase(
    @Inject(localPreviewRepositoryToken) repository: LocalPreviewRepository
  ) {
    return new ObserveLocalMediaUseCase(repository)
  }

  @Provides(StopLocalPreviewUseCase)
  static provideStopLocalPreviewUseCase(
    @Inject(localPreviewRepositoryToken) repository: LocalPreviewRepository
  ) {
    return new StopLocalPreviewUseCase(repository)
  }

  @Provides(GetUserPreferencesUseCase)
  static provideGetUserPreferencesUseCase(
    @Inject(userSettingsRepositoryToken) repository: UserSettingsRepository
  ) {
    return new GetUserPreferencesUseCase(repository)
  }

  @Provides(SaveDisplayNameUseCase)
  static provideSaveDisplayNameUseCase(
    @Inject(userSettingsRepositoryToken) repository: UserSettingsRepository
  ) {
    return new SaveDisplayNameUseCase(repository)
  }

  @Provides(SaveDefaultMicEnabledUseCase)
  static provideSaveDefaultMicEnabledUseCase(
    @Inject(userSettingsRepositoryToken) repository: UserSettingsRepository
  ) {
    return new SaveDefaultMicEnabledUseCase(repository)
  }

  @Provides(SaveDefaultCameraEnabledUseCase)
  static provideSaveDefaultCameraEnabledUseCase(
    @Inject(userSettingsRepositoryToken) repository: UserSettingsRepository
  ) {
    return new SaveDefaultCameraEnabledUseCase(repository)
  }

  @Provides(SavePreferredMicrophoneUseCase)
  static provideSavePreferredMicrophoneUseCase(
    @Inject(userSettingsRepositoryToken) repository: UserSettingsRepository
  ) {
    return new SavePreferredMicrophoneUseCase(repository)
  }

  @Provides(SavePreferredCameraUseCase)
  static provideSavePreferredCameraUseCase(
    @Inject(userSettingsRepositoryToken) repository: UserSettingsRepository
  ) {
    return new SavePreferredCameraUseCase(repository)
  }

  @Provides(LoadPrejoinContextUseCase)
  static provideLoadPrejoinContextUseCase(
    @Inject(GetRoomMetadataUseCase) room: GetRoomMetadataUseCase,
    @Inject(ListMediaDevicesUseCase) devices: ListMediaDevicesUseCase,
    @Inject(GetUserPreferencesUseCase) preferences: GetUserPreferencesUseCase
  ) {
    return new LoadPrejoinContextUseCase(room, devices, preferences)
  }

  @Provides(StartPrejoinPreviewUseCase)
  static provideStartPrejoinPreviewUseCase(
    @Inject(StartLocalPreviewUseCase) startPreview: StartLocalPreviewUseCase
  ) {
    return new StartPrejoinPreviewUseCase(startPreview)
  }

  @Provides(SaveJoinSessionUseCase)
  static provideSaveJoinSessionUseCase(
    @Inject(joinSessionRepositoryToken) repository: JoinSessionRepository
  ) {
    return new SaveJoinSessionUseCase(repository)
  }

  @Provides(LoadJoinSessionUseCase)
  static provideLoadJoinSessionUseCase(
    @Inject(joinSessionRepositoryToken) repository: JoinSessionRepository
  ) {
    return new LoadJoinSessionUseCase(repository)
  }

  @Provides(ClearJoinSessionUseCase)
  static provideClearJoinSessionUseCase(
    @Inject(joinSessionRepositoryToken) repository: JoinSessionRepository
  ) {
    return new ClearJoinSessionUseCase(repository)
  }

  @Provides(PrejoinJoinRoomFlowUseCase)
  static providePrejoinJoinRoomFlowUseCase(
    @Inject(JoinRoomUseCase) joinRoom: JoinRoomUseCase,
    @Inject(SaveDisplayNameUseCase) saveName: SaveDisplayNameUseCase,
    @Inject(SaveDefaultMicEnabledUseCase) saveMic: SaveDefaultMicEnabledUseCase,
    @Inject(SaveDefaultCameraEnabledUseCase) saveCamera: SaveDefaultCameraEnabledUseCase,
    @Inject(SavePreferredMicrophoneUseCase) saveMicrophone: SavePreferredMicrophoneUseCase,
    @Inject(SavePreferredCameraUseCase) savePreferredCamera: SavePreferredCameraUseCase,
    @Inject(SaveJoinSessionUseCase) saveSession: SaveJoinSessionUseCase
  ) {
    return new PrejoinJoinRoomFlowUseCase(
      joinRoom,
      saveName,
      saveMic,
      saveCamera,
      saveMicrophone,
      savePreferredCamera,
      saveSession
    )
  }

  @Provides(ConnectToRoomRtcUseCase)
  static provideConnectToRoomRtcUseCase(@Inject(rtcRepositoryToken) repository: RtcRepository) {
    return new ConnectToRoomRtcUseCase(repository)
  }

  @Provides(DisconnectRtcUseCase)
  static provideDisconnectRtcUseCase(@Inject(rtcRepositoryToken) repository: RtcRepository) {
    return new DisconnectRtcUseCase(repository)
  }

  @Provides(RestartIceUseCase)
  static provideRestartIceUseCase(@Inject(rtcRepositoryToken) repository: RtcRepository) {
    return new RestartIceUseCase(repository)
  }

  @Provides(DecideIceRecoveryUseCase)
  static provideDecideIceRecoveryUseCase() {
    return new DecideIceRecoveryUseCase()
  }

  @Provides(SetRtcMicrophoneEnabledUseCase)
  static provideSetRtcMicrophoneEnabledUseCase(
    @Inject(rtcRepositoryToken) repository: RtcRepository
  ) {
    return new SetRtcMicrophoneEnabledUseCase(repository)
  }

  @Provides(SetRtcCameraEnabledUseCase)
  static provideSetRtcCameraEnabledUseCase(@Inject(rtcRepositoryToken) repository: RtcRepository) {
    return new SetRtcCameraEnabledUseCase(repository)
  }

  @Provides(SetRtcScreenShareEnabledUseCase)
  static provideSetRtcScreenShareEnabledUseCase(
    @Inject(rtcRepositoryToken) repository: RtcRepository
  ) {
    return new SetRtcScreenShareEnabledUseCase(repository)
  }

  @Provides(ObserveRoomSessionUseCase)
  static provideObserveRoomSessionUseCase(@Inject(rtcRepositoryToken) repository: RtcRepository) {
    return new ObserveRoomSessionUseCase(repository)
  }

  @Provides(ObserveRoomDiagnosticsUseCase)
  static provideObserveRoomDiagnosticsUseCase(
    @Inject(rtcRepositoryToken) repository: RtcRepository
  ) {
    return new ObserveRoomDiagnosticsUseCase(repository)
  }

  @Provides(ToggleRoomMicrophoneUseCase)
  static provideToggleRoomMicrophoneUseCase(
    @Inject(SetRtcMicrophoneEnabledUseCase) setMic: SetRtcMicrophoneEnabledUseCase
  ) {
    return new ToggleRoomMicrophoneUseCase(setMic)
  }

  @Provides(ToggleRoomCameraUseCase)
  static provideToggleRoomCameraUseCase(
    @Inject(SetRtcCameraEnabledUseCase) setCamera: SetRtcCameraEnabledUseCase
  ) {
    return new ToggleRoomCameraUseCase(setCamera)
  }

  @Provides(ToggleRoomScreenShareUseCase)
  static provideToggleRoomScreenShareUseCase(
    @Inject(SetRtcScreenShareEnabledUseCase) setScreen: SetRtcScreenShareEnabledUseCase
  ) {
    return new ToggleRoomScreenShareUseCase(setScreen)
  }

  @Provides(LeaveRoomUseCase)
  static provideLeaveRoomUseCase(
    @Inject(DisconnectRtcUseCase) disconnect: DisconnectRtcUseCase,
    @Inject(StopLocalPreviewUseCase) stopPreview: StopLocalPreviewUseCase
  ) {
    return new LeaveRoomUseCase(disconnect, stopPreview)
  }

  @Provides(CopyTextUseCase)
  static provideCopyTextUseCase(@Inject(clipboardRepositoryToken) repository: ClipboardRepository) {
    return new CopyTextUseCase(repository)
  }

  @Provides(PlayConferenceSoundUseCase)
  static providePlayConferenceSoundUseCase(
    @Inject(conferenceAudioRepositoryToken) repository: ConferenceAudioRepository
  ) {
    return new PlayConferenceSoundUseCase(repository)
  }

  @Provides(ObserveVoiceActivityUseCase)
  static provideObserveVoiceActivityUseCase(
    @Inject(voiceActivityRepositoryToken) repository: VoiceActivityRepository
  ) {
    return new ObserveVoiceActivityUseCase(repository)
  }

  @Provides(UpdateVoiceActivitySourcesUseCase)
  static provideUpdateVoiceActivitySourcesUseCase(
    @Inject(voiceActivityRepositoryToken) repository: VoiceActivityRepository
  ) {
    return new UpdateVoiceActivitySourcesUseCase(repository)
  }

  @Provides(StopVoiceActivityUseCase)
  static provideStopVoiceActivityUseCase(
    @Inject(voiceActivityRepositoryToken) repository: VoiceActivityRepository
  ) {
    return new StopVoiceActivityUseCase(repository)
  }

  @Provides(BuildRoomLinkUseCase)
  static provideBuildRoomLinkUseCase() {
    return new BuildRoomLinkUseCase()
  }

  @Provides(CopyRoomLinkUseCase)
  static provideCopyRoomLinkUseCase(
    @Inject(BuildRoomLinkUseCase) buildLink: BuildRoomLinkUseCase,
    @Inject(CopyTextUseCase) copyText: CopyTextUseCase
  ) {
    return new CopyRoomLinkUseCase(buildLink, copyText)
  }

  @Provides(ExportClientLogsUseCase)
  static provideExportClientLogsUseCase(
    @Inject(clientLogRepositoryToken) repository: ClientLogRepository
  ) {
    return new ExportClientLogsUseCase(repository)
  }

  @Provides(AppendClientLogUseCase)
  static provideAppendClientLogUseCase(
    @Inject(clientLogRepositoryToken) repository: ClientLogRepository
  ) {
    return new AppendClientLogUseCase(repository)
  }

  @Provides(ClearClientLogsUseCase)
  static provideClearClientLogsUseCase(
    @Inject(clientLogRepositoryToken) repository: ClientLogRepository
  ) {
    return new ClearClientLogsUseCase(repository)
  }

  @Provides(HomeViewModel)
  @ViewModelProvider()
  static provideHomeViewModel(
    @Inject(CreateRoomFlowUseCase) createRoom: CreateRoomFlowUseCase,
    @Inject(HomeJoinRoomFlowUseCase) joinRoom: HomeJoinRoomFlowUseCase
  ) {
    return new HomeViewModel(createRoom, joinRoom)
  }

  @Provides(PrejoinViewModel)
  @ViewModelProvider()
  static providePrejoinViewModel(
    @Inject(LoadPrejoinContextUseCase) loadContext: LoadPrejoinContextUseCase,
    @Inject(StartPrejoinPreviewUseCase) startPreview: StartPrejoinPreviewUseCase,
    @Inject(ObserveLocalMediaUseCase) observeMedia: ObserveLocalMediaUseCase,
    @Inject(SetMicrophoneEnabledUseCase) setMicrophoneEnabled: SetMicrophoneEnabledUseCase,
    @Inject(SetCameraEnabledUseCase) setCameraEnabled: SetCameraEnabledUseCase,
    @Inject(PrejoinJoinRoomFlowUseCase) joinRoom: PrejoinJoinRoomFlowUseCase
  ) {
    return new PrejoinViewModel(
      loadContext,
      startPreview,
      observeMedia,
      setMicrophoneEnabled,
      setCameraEnabled,
      joinRoom
    )
  }

  @Provides(RoomViewModel)
  @ViewModelProvider()
  static provideRoomViewModel(
    @Inject(LoadJoinSessionUseCase) loadSession: LoadJoinSessionUseCase,
    @Inject(GetRoomMetadataUseCase) getRoomMetadata: GetRoomMetadataUseCase,
    @Inject(ConnectToRoomRtcUseCase) connectRtc: ConnectToRoomRtcUseCase,
    @Inject(ObserveRoomSessionUseCase) observeRoom: ObserveRoomSessionUseCase,
    @Inject(ObserveRoomDiagnosticsUseCase) observeDiagnostics: ObserveRoomDiagnosticsUseCase,
    @Inject(ToggleRoomMicrophoneUseCase) toggleMic: ToggleRoomMicrophoneUseCase,
    @Inject(ToggleRoomCameraUseCase) toggleCamera: ToggleRoomCameraUseCase,
    @Inject(ToggleRoomScreenShareUseCase) toggleScreen: ToggleRoomScreenShareUseCase,
    @Inject(CopyRoomLinkUseCase) copyLink: CopyRoomLinkUseCase,
    @Inject(ExportClientLogsUseCase) exportLogs: ExportClientLogsUseCase,
    @Inject(ClearClientLogsUseCase) clearLogs: ClearClientLogsUseCase,
    @Inject(ClearJoinSessionUseCase) clearSession: ClearJoinSessionUseCase,
    @Inject(LeaveRoomUseCase) leaveRoom: LeaveRoomUseCase,
    @Inject(PlayConferenceSoundUseCase) playConferenceSound: PlayConferenceSoundUseCase,
    @Inject(ObserveVoiceActivityUseCase) observeVoiceActivity: ObserveVoiceActivityUseCase,
    @Inject(UpdateVoiceActivitySourcesUseCase)
    updateVoiceActivitySources: UpdateVoiceActivitySourcesUseCase,
    @Inject(StopVoiceActivityUseCase) stopVoiceActivity: StopVoiceActivityUseCase
  ) {
    return new RoomViewModel(
      loadSession,
      getRoomMetadata,
      connectRtc,
      observeRoom,
      observeDiagnostics,
      toggleMic,
      toggleCamera,
      toggleScreen,
      copyLink,
      exportLogs,
      clearLogs,
      clearSession,
      leaveRoom,
      playConferenceSound,
      observeVoiceActivity,
      updateVoiceActivitySources,
      stopVoiceActivity
    )
  }

  @Provides(SettingsViewModel)
  @ViewModelProvider()
  static provideSettingsViewModel(
    @Inject(GetUserPreferencesUseCase) getPreferences: GetUserPreferencesUseCase,
    @Inject(ListMediaDevicesUseCase) listDevices: ListMediaDevicesUseCase,
    @Inject(ObserveLocalMediaUseCase) observeMedia: ObserveLocalMediaUseCase,
    @Inject(StartLocalPreviewUseCase) startPreview: StartLocalPreviewUseCase,
    @Inject(StopLocalPreviewUseCase) stopPreview: StopLocalPreviewUseCase,
    @Inject(SetMicrophoneEnabledUseCase) setMicrophoneEnabled: SetMicrophoneEnabledUseCase,
    @Inject(SetCameraEnabledUseCase) setCameraEnabled: SetCameraEnabledUseCase,
    @Inject(SaveDisplayNameUseCase) saveDisplayName: SaveDisplayNameUseCase,
    @Inject(SaveDefaultMicEnabledUseCase) saveDefaultMic: SaveDefaultMicEnabledUseCase,
    @Inject(SaveDefaultCameraEnabledUseCase) saveDefaultCamera: SaveDefaultCameraEnabledUseCase,
    @Inject(SavePreferredMicrophoneUseCase) saveMicrophone: SavePreferredMicrophoneUseCase,
    @Inject(SavePreferredCameraUseCase) saveCamera: SavePreferredCameraUseCase
  ) {
    return new SettingsViewModel(
      getPreferences,
      listDevices,
      observeMedia,
      startPreview,
      stopPreview,
      setMicrophoneEnabled,
      setCameraEnabled,
      saveDisplayName,
      saveDefaultMic,
      saveDefaultCamera,
      saveMicrophone,
      saveCamera
    )
  }
}

export const voiceModule = createModuleFromClass(VoiceModule)
