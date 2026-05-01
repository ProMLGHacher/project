import { Inject, Module, Provides, Singleton, createModuleFromClass } from '@kvt/core'
import { HttpRoomRepository } from './data/repository/HttpRoomRepository'
import { roomRepositoryToken } from './domain/repository/tokens'
import { CreateRoomUseCase } from './domain/usecases/CreateRoomUseCase'
import { CreateRoomChatSessionUseCase } from './domain/usecases/CreateRoomChatSessionUseCase'
import { GetRoomMetadataUseCase } from './domain/usecases/GetRoomMetadataUseCase'
import { JoinRoomUseCase } from './domain/usecases/JoinRoomUseCase'
import { RoomExistsByIdUseCase } from './domain/usecases/RoomExistsByIdUseCase'
import type { RoomRepository } from './domain/repository/RoomRepository'

@Module({ name: 'RoomCoreModule' })
class RoomCoreModule {
  @Provides(roomRepositoryToken)
  @Singleton({ lazy: true })
  static provideRoomRepository(): RoomRepository {
    return new HttpRoomRepository()
  }

  @Provides(CreateRoomUseCase)
  static provideCreateRoomUseCase(@Inject(roomRepositoryToken) repository: RoomRepository) {
    return new CreateRoomUseCase(repository)
  }

  @Provides(CreateRoomChatSessionUseCase)
  static provideCreateRoomChatSessionUseCase(
    @Inject(roomRepositoryToken) repository: RoomRepository
  ) {
    return new CreateRoomChatSessionUseCase(repository)
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
}

export const roomCoreModule = createModuleFromClass(RoomCoreModule)
