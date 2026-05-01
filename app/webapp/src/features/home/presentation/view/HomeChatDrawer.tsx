import { useEffect, useRef, type KeyboardEvent, type ReactNode } from 'react'
import type { TFunction } from 'i18next'
import { renderMarkdown } from '@kvatum/chat-sdk'
import { Button, Textarea, cn } from '@core/design-system'
import type { HomeChatDrawerState } from '../model/HomeState'

type VoiceT = TFunction<'voice'>

export interface HomeChatDrawerProps {
  readonly chat: HomeChatDrawerState
  readonly onClose: () => void
  readonly onDraftChange: (value: string) => void
  readonly onSend: () => void
  readonly t: VoiceT
}

export function HomeChatDrawer({
  chat,
  onClose,
  onDraftChange,
  onSend,
  t
}: HomeChatDrawerProps): ReactNode {
  const messagesRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const node = messagesRef.current
    if (node) {
      node.scrollTop = node.scrollHeight
    }
  }, [chat.messages.length, chat.open])

  if (!chat.open) {
    return null
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) {
      return
    }
    event.preventDefault()
    onSend()
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-background/35 backdrop-blur-sm">
      <button
        aria-label={t('home.closeChat')}
        className="absolute inset-0 cursor-default"
        type="button"
        onClick={onClose}
      />
      <aside className="animate-panel-in relative grid h-full w-full max-w-[28rem] grid-rows-[auto_minmax(0,1fr)_auto] border-l border-border bg-surface text-foreground shadow-2xl">
        <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
          <div className="min-w-0">
            <h2 className="truncate text-base font-semibold">
              {t('home.chatTitle', { roomId: chat.roomId ?? '' })}
            </h2>
            {chat.status !== 'connected' && (
              <p className="mt-0.5 text-xs text-muted-foreground">{chat.status}</p>
            )}
          </div>
          <button
            aria-label={t('home.closeChat')}
            className="grid size-9 place-items-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
            type="button"
            onClick={onClose}
          >
            x
          </button>
        </header>

        <div ref={messagesRef} className="min-h-0 overflow-auto overscroll-contain px-3 py-3">
          {chat.loading ? (
            <div className="grid min-h-48 place-items-center text-sm text-muted-foreground">
              {t('home.chatLoading')}
            </div>
          ) : chat.messages.length === 0 ? (
            <div className="grid min-h-48 place-items-center text-sm text-muted-foreground">
              {t('room.chat.empty')}
            </div>
          ) : (
            <div className="grid gap-3">
              {chat.messages.map((message, index) => {
                const previous = chat.messages[index - 1]
                const compact = previous?.author.id === message.author.id && !message.replyToId
                return <MessageItem key={message.id} compact={compact} message={message} />
              })}
            </div>
          )}
        </div>

        <footer className="border-t border-border p-3">
          {chat.error && <p className="mb-2 text-xs text-destructive">{formatError(chat.error, t)}</p>}
          <Textarea
            className="max-h-32 min-h-16 resize-none rounded-md border-border bg-muted text-foreground"
            placeholder={t('room.chat.placeholder')}
            value={chat.draft}
            onChange={(event) => onDraftChange(event.target.value)}
            onKeyDown={handleKeyDown}
          />
          <div className="mt-2 flex items-center justify-between gap-3">
            <p className="text-[0.68rem] text-muted-foreground">
              Enter - отправить, Shift+Enter - новая строка
            </p>
            <Button
              className="rounded-md px-5"
              disabled={!chat.draft.trim() || chat.status !== 'connected'}
              type="button"
              onClick={onSend}
            >
              {t('room.chat.send')}
            </Button>
          </div>
        </footer>
      </aside>
    </div>
  )
}

function MessageItem({
  compact,
  message
}: {
  readonly compact: boolean
  readonly message: HomeChatDrawerState['messages'][number]
}) {
  return (
    <article className={cn('grid grid-cols-[2rem_minmax(0,1fr)] gap-2', compact && 'mt-[-0.35rem]')}>
      <div className="pt-0.5">
        {!compact && (
          <div className="grid size-8 place-items-center rounded-full bg-muted text-xs font-semibold">
            {message.author.displayName.slice(0, 1).toUpperCase()}
          </div>
        )}
      </div>
      <div className="min-w-0">
        {!compact && (
          <div className="flex items-baseline gap-2">
            <p className="truncate text-sm font-semibold text-primary">
              {message.author.displayName}
            </p>
            <time className="text-[0.68rem] text-muted-foreground">
              {formatTime(message.createdAt)}
            </time>
          </div>
        )}
        <div
          className="chat-markdown break-words text-sm leading-5 text-foreground [&_a]:text-primary [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_p]:my-0"
          dangerouslySetInnerHTML={{
            __html: message.deletedAt ? 'Сообщение удалено.' : renderMarkdown(message.bodyMarkdown)
          }}
        />
      </div>
    </article>
  )
}

function formatTime(value: string): string {
  return new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' }).format(
    new Date(value)
  )
}

function formatError(error: string, t: VoiceT): string {
  return error.startsWith('home.') ? t(error as never) : error
}
