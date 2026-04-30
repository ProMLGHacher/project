import type { ChatRepository } from '../repository/ChatRepository'

export class EditChatMessageUseCase {
  constructor(private readonly repository: ChatRepository) {}

  execute(messageId: string, markdown: string) {
    return this.repository.editMessage(messageId, markdown)
  }
}
