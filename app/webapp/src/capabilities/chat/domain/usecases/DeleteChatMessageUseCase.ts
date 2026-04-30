import type { ChatRepository } from '../repository/ChatRepository'

export class DeleteChatMessageUseCase {
  constructor(private readonly repository: ChatRepository) {}

  execute(messageId: string) {
    return this.repository.deleteMessage(messageId)
  }
}
