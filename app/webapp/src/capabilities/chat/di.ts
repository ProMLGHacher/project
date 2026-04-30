import { Inject, Module, Provides, Singleton, createModuleFromClass } from '@kvt/core'
import { BrowserChatRepository } from './data/repository/BrowserChatRepository'
import { chatRepositoryToken } from './domain/repository/tokens'
import { ConnectChatUseCase } from './domain/usecases/ConnectChatUseCase'
import { DeleteChatMessageUseCase } from './domain/usecases/DeleteChatMessageUseCase'
import { DisconnectChatUseCase } from './domain/usecases/DisconnectChatUseCase'
import { EditChatMessageUseCase } from './domain/usecases/EditChatMessageUseCase'
import { MarkChatReadUseCase } from './domain/usecases/MarkChatReadUseCase'
import { ObserveChatUseCase } from './domain/usecases/ObserveChatUseCase'
import { SendChatMessageUseCase } from './domain/usecases/SendChatMessageUseCase'
import { ToggleChatReactionUseCase } from './domain/usecases/ToggleChatReactionUseCase'
import { UploadChatAttachmentUseCase } from './domain/usecases/UploadChatAttachmentUseCase'
import type { ChatRepository } from './domain/repository/ChatRepository'

@Module({ name: 'ChatCapabilityModule' })
class ChatCapabilityModule {
  @Provides(chatRepositoryToken)
  @Singleton({ lazy: true })
  static provideChatRepository(): ChatRepository {
    return new BrowserChatRepository()
  }

  @Provides(ConnectChatUseCase)
  static provideConnectChatUseCase(@Inject(chatRepositoryToken) repository: ChatRepository) {
    return new ConnectChatUseCase(repository)
  }

  @Provides(DisconnectChatUseCase)
  static provideDisconnectChatUseCase(@Inject(chatRepositoryToken) repository: ChatRepository) {
    return new DisconnectChatUseCase(repository)
  }

  @Provides(ObserveChatUseCase)
  static provideObserveChatUseCase(@Inject(chatRepositoryToken) repository: ChatRepository) {
    return new ObserveChatUseCase(repository)
  }

  @Provides(SendChatMessageUseCase)
  static provideSendChatMessageUseCase(@Inject(chatRepositoryToken) repository: ChatRepository) {
    return new SendChatMessageUseCase(repository)
  }

  @Provides(MarkChatReadUseCase)
  static provideMarkChatReadUseCase(@Inject(chatRepositoryToken) repository: ChatRepository) {
    return new MarkChatReadUseCase(repository)
  }

  @Provides(ToggleChatReactionUseCase)
  static provideToggleChatReactionUseCase(@Inject(chatRepositoryToken) repository: ChatRepository) {
    return new ToggleChatReactionUseCase(repository)
  }

  @Provides(EditChatMessageUseCase)
  static provideEditChatMessageUseCase(@Inject(chatRepositoryToken) repository: ChatRepository) {
    return new EditChatMessageUseCase(repository)
  }

  @Provides(DeleteChatMessageUseCase)
  static provideDeleteChatMessageUseCase(@Inject(chatRepositoryToken) repository: ChatRepository) {
    return new DeleteChatMessageUseCase(repository)
  }

  @Provides(UploadChatAttachmentUseCase)
  static provideUploadChatAttachmentUseCase(@Inject(chatRepositoryToken) repository: ChatRepository) {
    return new UploadChatAttachmentUseCase(repository)
  }
}

export const chatCapabilityModule = createModuleFromClass(ChatCapabilityModule)
export default chatCapabilityModule
