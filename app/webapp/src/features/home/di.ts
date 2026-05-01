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
    @Inject(SaveRecentRoomVisitUseCase) saveRecentRoomVisit: SaveRecentRoomVisitUseCase
  ) {
    return new HomeViewModel(createRoom, joinRoom, getRecentRooms, saveRecentRoomVisit)
  }
}

export const homeModule = createModuleFromClass(HomeModule)
export default homeModule
