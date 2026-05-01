import type { ReactNode } from 'react'
import type { TFunction } from 'i18next'
import { ChatPanel } from '@features/chat/presentation/view/ChatPanel'
import type { HomeChatDrawerState } from '../model/HomeState'

type VoiceT = TFunction<'voice'>

export interface HomeChatDrawerProps {
  readonly chat: HomeChatDrawerState
  readonly onClose: () => void
  readonly onDelete: (messageId: string) => void
  readonly onDraftChange: (value: string) => void
  readonly onEdit: (messageId: string) => void
  readonly onEditCancel: () => void
  readonly onEditDraftChange: (value: string) => void
  readonly onEditSubmit: (messageId: string) => void
  readonly onFileSelected: (file: File) => void
  readonly onLatestVisible: () => void
  readonly onReaction: (messageId: string, emoji: string) => void
  readonly onReply: (messageId: string) => void
  readonly onReplyCancel: () => void
  readonly onReplyPreview: (messageId: string) => void
  readonly onSend: () => void
  readonly t: VoiceT
}

export function HomeChatDrawer({
  chat,
  onClose,
  onDelete,
  onDraftChange,
  onEdit,
  onEditCancel,
  onEditDraftChange,
  onEditSubmit,
  onFileSelected,
  onLatestVisible,
  onReaction,
  onReply,
  onReplyCancel,
  onReplyPreview,
  onSend,
  t
}: HomeChatDrawerProps): ReactNode {
  if (!chat.open) {
    return null
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-background/35 backdrop-blur-sm">
      <button
        aria-label={t('home.closeChat')}
        className="absolute inset-0 cursor-default"
        type="button"
        onClick={onClose}
      />
      <div className="relative h-full w-full max-w-[32rem] p-2 sm:p-3">
        <ChatPanel
          chat={chat}
          className="rounded-lg lg:w-full xl:w-full"
          closeLabel={t('home.closeChat')}
          localParticipantId={chat.localParticipantId}
          title={t('home.chatTitle', { roomId: chat.roomId ?? '' })}
          t={t}
          onClose={onClose}
          onDelete={onDelete}
          onDraftChange={onDraftChange}
          onEdit={onEdit}
          onEditCancel={onEditCancel}
          onEditDraftChange={onEditDraftChange}
          onEditSubmit={onEditSubmit}
          onFileSelected={onFileSelected}
          onLatestVisible={onLatestVisible}
          onReaction={onReaction}
          onReply={onReply}
          onReplyCancel={onReplyCancel}
          onReplyPreview={onReplyPreview}
          onSend={onSend}
        />
      </div>
    </div>
  )
}
