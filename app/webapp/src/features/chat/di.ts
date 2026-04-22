import {
  Inject,
  Module,
  Provides,
  Singleton,
  ViewModelProvider,
  createModuleFromClass
} from '@kvt/core'
import { InMemoryChatRepository } from './data'
import {
  chatRepositoryToken,
  DeleteMessageUseCase,
  MarkChatReadUseCase,
  SendChatMessageUseCase,
  ToggleMessageReactionUseCase,
  type ChatRepository
} from './domain'
import { ChatViewModel } from './presentation'

@Module({ name: 'ChatModule' })
class ChatModule {
  @Provides(chatRepositoryToken)
  @Singleton({ lazy: true })
  static provideChatRepository(): ChatRepository {
    return new InMemoryChatRepository()
  }

  @Provides(SendChatMessageUseCase)
  static provideSendChatMessageUseCase(
    @Inject(chatRepositoryToken) repository: ChatRepository
  ): SendChatMessageUseCase {
    return new SendChatMessageUseCase(repository)
  }

  @Provides(MarkChatReadUseCase)
  static provideMarkChatReadUseCase(
    @Inject(chatRepositoryToken) repository: ChatRepository
  ): MarkChatReadUseCase {
    return new MarkChatReadUseCase(repository)
  }

  @Provides(ToggleMessageReactionUseCase)
  static provideToggleMessageReactionUseCase(
    @Inject(chatRepositoryToken) repository: ChatRepository
  ): ToggleMessageReactionUseCase {
    return new ToggleMessageReactionUseCase(repository)
  }

  @Provides(DeleteMessageUseCase)
  static provideDeleteMessageUseCase(
    @Inject(chatRepositoryToken) repository: ChatRepository
  ): DeleteMessageUseCase {
    return new DeleteMessageUseCase(repository)
  }

  @Provides(ChatViewModel)
  @ViewModelProvider()
  static provideChatViewModel(
    @Inject(chatRepositoryToken) repository: ChatRepository,
    @Inject(SendChatMessageUseCase) sendMessage: SendChatMessageUseCase,
    @Inject(MarkChatReadUseCase) markChatRead: MarkChatReadUseCase,
    @Inject(ToggleMessageReactionUseCase) toggleReaction: ToggleMessageReactionUseCase,
    @Inject(DeleteMessageUseCase) deleteMessage: DeleteMessageUseCase
  ): ChatViewModel {
    return new ChatViewModel(repository, sendMessage, markChatRead, toggleReaction, deleteMessage)
  }
}

export const chatModule = createModuleFromClass(ChatModule)

export default chatModule
