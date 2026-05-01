import { Inject, Module, Provides, ViewModelProvider, createModuleFromClass } from '@kvt/core'
import { RoomExistsByIdUseCase } from '@features/room/domain/usecases/RoomExistsByIdUseCase'
import { LocalStorageRecentRoomsRepository } from './data/LocalStorageRecentRoomsRepository'
import { CreateRoomFlowUseCase } from './domain/usecases/CreateRoomFlowUseCase'
import { GetRecentRoomsUseCase } from './domain/usecases/GetRecentRoomsUseCase'
import { JoinRoomFlowUseCase } from './domain/usecases/JoinRoomFlowUseCase'
import { SaveRecentRoomVisitUseCase } from './domain/usecases/SaveRecentRoomVisitUseCase'
import { ValidateRoomIdInputUseCase } from './domain/usecases/ValidateRoomIdInputUseCase'
import { recentRoomsRepositoryToken } from './domain/repository/tokens'
import { HomeViewModel } from './presentation/view_model/HomeViewModel'
import { CreateRoomUseCase } from '@features/room/domain/usecases/CreateRoomUseCase'
import { JoinRoomUseCase } from '@features/room/domain/usecases/JoinRoomUseCase'
import { ConnectChatUseCase } from '@capabilities/chat/domain/usecases/ConnectChatUseCase'
import { DisconnectChatUseCase } from '@capabilities/chat/domain/usecases/DisconnectChatUseCase'
import { DeleteChatMessageUseCase } from '@capabilities/chat/domain/usecases/DeleteChatMessageUseCase'
import { EditChatMessageUseCase } from '@capabilities/chat/domain/usecases/EditChatMessageUseCase'
import { MarkChatReadUseCase } from '@capabilities/chat/domain/usecases/MarkChatReadUseCase'
import { ObserveChatUseCase } from '@capabilities/chat/domain/usecases/ObserveChatUseCase'
import { SendChatMessageUseCase } from '@capabilities/chat/domain/usecases/SendChatMessageUseCase'
import { ToggleChatReactionUseCase } from '@capabilities/chat/domain/usecases/ToggleChatReactionUseCase'
import { UploadChatAttachmentUseCase } from '@capabilities/chat/domain/usecases/UploadChatAttachmentUseCase'
import { GetUserPreferencesUseCase } from '@capabilities/user-preferences/domain/usecases/GetUserPreferencesUseCase'
import type { RecentRoomsRepository } from './domain/repository/RecentRoomsRepository'

@Module({ name: 'HomeModule' })
class HomeModule {
  @Provides(recentRoomsRepositoryToken)
  static provideRecentRoomsRepository(): RecentRoomsRepository {
    return new LocalStorageRecentRoomsRepository()
  }

  @Provides(CreateRoomFlowUseCase)
  static provideCreateRoomFlowUseCase(@Inject(CreateRoomUseCase) useCase: CreateRoomUseCase) {
    return new CreateRoomFlowUseCase(useCase)
  }

  @Provides(ValidateRoomIdInputUseCase)
  static provideValidateRoomIdInputUseCase() {
    return new ValidateRoomIdInputUseCase()
  }

  @Provides(JoinRoomFlowUseCase)
  static provideJoinRoomFlowUseCase(
    @Inject(ValidateRoomIdInputUseCase) validate: ValidateRoomIdInputUseCase,
    @Inject(RoomExistsByIdUseCase) exists: RoomExistsByIdUseCase
  ) {
    return new JoinRoomFlowUseCase(validate, exists)
  }

  @Provides(GetRecentRoomsUseCase)
  static provideGetRecentRoomsUseCase(
    @Inject(recentRoomsRepositoryToken) repository: RecentRoomsRepository
  ) {
    return new GetRecentRoomsUseCase(repository)
  }

  @Provides(SaveRecentRoomVisitUseCase)
  static provideSaveRecentRoomVisitUseCase(
    @Inject(recentRoomsRepositoryToken) repository: RecentRoomsRepository
  ) {
    return new SaveRecentRoomVisitUseCase(repository)
  }

  @Provides(HomeViewModel)
  @ViewModelProvider()
  static provideHomeViewModel(
    @Inject(CreateRoomFlowUseCase) createRoom: CreateRoomFlowUseCase,
    @Inject(JoinRoomFlowUseCase) joinRoom: JoinRoomFlowUseCase,
    @Inject(GetRecentRoomsUseCase) getRecentRooms: GetRecentRoomsUseCase,
    @Inject(SaveRecentRoomVisitUseCase) saveRecentRoomVisit: SaveRecentRoomVisitUseCase,
    @Inject(JoinRoomUseCase) joinRoomSession: JoinRoomUseCase,
    @Inject(GetUserPreferencesUseCase) getUserPreferences: GetUserPreferencesUseCase,
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
    return new HomeViewModel(
      createRoom,
      joinRoom,
      getRecentRooms,
      saveRecentRoomVisit,
      joinRoomSession,
      getUserPreferences,
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

export const homeModule = createModuleFromClass(HomeModule)
export default homeModule
