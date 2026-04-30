import { Inject, Module, Provides, ViewModelProvider, createModuleFromClass } from '@kvt/core'
import { ClearClientLogsUseCase } from '@capabilities/client-logs/domain/usecases/ClearClientLogsUseCase'
import { ConnectChatUseCase } from '@capabilities/chat/domain/usecases/ConnectChatUseCase'
import { DeleteChatMessageUseCase } from '@capabilities/chat/domain/usecases/DeleteChatMessageUseCase'
import { DisconnectChatUseCase } from '@capabilities/chat/domain/usecases/DisconnectChatUseCase'
import { EditChatMessageUseCase } from '@capabilities/chat/domain/usecases/EditChatMessageUseCase'
import { MarkChatReadUseCase } from '@capabilities/chat/domain/usecases/MarkChatReadUseCase'
import { ObserveChatUseCase } from '@capabilities/chat/domain/usecases/ObserveChatUseCase'
import { SendChatMessageUseCase } from '@capabilities/chat/domain/usecases/SendChatMessageUseCase'
import { ToggleChatReactionUseCase } from '@capabilities/chat/domain/usecases/ToggleChatReactionUseCase'
import { UploadChatAttachmentUseCase } from '@capabilities/chat/domain/usecases/UploadChatAttachmentUseCase'
import { ExportClientLogsUseCase } from '@capabilities/client-logs/domain/usecases/ExportClientLogsUseCase'
import { CopyTextUseCase } from '@capabilities/clipboard/domain/usecases/CopyTextUseCase'
import { PlayConferenceSoundUseCase } from '@capabilities/conference-audio/domain/usecases/PlayConferenceSoundUseCase'
import { StopLocalPreviewUseCase } from '@capabilities/media/domain/usecases/StopLocalPreviewUseCase'
import { GetUserPreferencesUseCase } from '@capabilities/user-preferences/domain/usecases/GetUserPreferencesUseCase'
import { ConnectToRoomRtcUseCase } from '@capabilities/rtc/domain/usecases/ConnectToRoomRtcUseCase'
import { DisconnectRtcUseCase } from '@capabilities/rtc/domain/usecases/DisconnectRtcUseCase'
import { SetRtcCameraEnabledUseCase } from '@capabilities/rtc/domain/usecases/SetRtcCameraEnabledUseCase'
import { SetRtcMicrophoneEnabledUseCase } from '@capabilities/rtc/domain/usecases/SetRtcMicrophoneEnabledUseCase'
import { SetRtcScreenShareEnabledUseCase } from '@capabilities/rtc/domain/usecases/SetRtcScreenShareEnabledUseCase'
import { ClearJoinSessionUseCase } from '@capabilities/session/domain/usecases/ClearJoinSessionUseCase'
import { LoadJoinSessionUseCase } from '@capabilities/session/domain/usecases/LoadJoinSessionUseCase'
import { ObserveVoiceActivityUseCase } from '@capabilities/voice-activity/domain/usecases/ObserveVoiceActivityUseCase'
import { StopVoiceActivityUseCase } from '@capabilities/voice-activity/domain/usecases/StopVoiceActivityUseCase'
import { UpdateVoiceActivitySourcesUseCase } from '@capabilities/voice-activity/domain/usecases/UpdateVoiceActivitySourcesUseCase'
import { prejoinModule } from '@features/prejoin/di'
import { roomCoreModule } from './core-di'
import { BuildRoomLinkUseCase } from './domain/usecases/BuildRoomLinkUseCase'
import { CopyRoomLinkUseCase } from './domain/usecases/CopyRoomLinkUseCase'
import { GetRoomMetadataUseCase } from './domain/usecases/GetRoomMetadataUseCase'
import { LeaveRoomUseCase } from './domain/usecases/LeaveRoomUseCase'
import { ObserveRoomDiagnosticsUseCase } from './domain/usecases/ObserveRoomDiagnosticsUseCase'
import { ObserveRoomSessionUseCase } from './domain/usecases/ObserveRoomSessionUseCase'
import { ToggleRoomCameraUseCase } from './domain/usecases/ToggleRoomCameraUseCase'
import { ToggleRoomMicrophoneUseCase } from './domain/usecases/ToggleRoomMicrophoneUseCase'
import { ToggleRoomScreenShareUseCase } from './domain/usecases/ToggleRoomScreenShareUseCase'
import { RoomViewModel } from './presentation/view_model/RoomViewModel'
import type { RtcRepository } from '@capabilities/rtc/domain/repository/RtcRepository'
import { rtcRepositoryToken } from '@capabilities/rtc/domain/repository/tokens'

@Module({ name: 'RoomModule', includes: [prejoinModule, roomCoreModule] })
class RoomModule {
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

  @Provides(RoomViewModel)
  @ViewModelProvider()
  static provideRoomViewModel(
    @Inject(LoadJoinSessionUseCase) loadSession: LoadJoinSessionUseCase,
    @Inject(GetUserPreferencesUseCase) getUserPreferences: GetUserPreferencesUseCase,
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
    @Inject(StopVoiceActivityUseCase) stopVoiceActivity: StopVoiceActivityUseCase,
    @Inject(ConnectChatUseCase) connectChat: ConnectChatUseCase,
    @Inject(DisconnectChatUseCase) disconnectChat: DisconnectChatUseCase,
    @Inject(ObserveChatUseCase) observeChat: ObserveChatUseCase,
    @Inject(SendChatMessageUseCase) sendChatMessage: SendChatMessageUseCase,
    @Inject(MarkChatReadUseCase) markChatRead: MarkChatReadUseCase,
    @Inject(ToggleChatReactionUseCase) toggleChatReaction: ToggleChatReactionUseCase,
    @Inject(EditChatMessageUseCase) editChatMessage: EditChatMessageUseCase,
    @Inject(DeleteChatMessageUseCase) deleteChatMessage: DeleteChatMessageUseCase,
    @Inject(UploadChatAttachmentUseCase) uploadChatAttachment: UploadChatAttachmentUseCase
  ) {
    return new RoomViewModel(
      loadSession,
      getUserPreferences,
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
      stopVoiceActivity,
      connectChat,
      disconnectChat,
      observeChat,
      sendChatMessage,
      markChatRead,
      toggleChatReaction,
      editChatMessage,
      deleteChatMessage,
      uploadChatAttachment
    )
  }
}

export const roomModule = createModuleFromClass(RoomModule)
export default roomModule
