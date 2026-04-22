import { useSharedFlow, useStateFlow, useViewModel } from '@kvt/react'
import {
  Avatar,
  Badge,
  Button,
  Card,
  CardContent,
  Empty,
  Input,
  Kbd,
  Sheet,
  ScrollArea,
  Separator,
  Textarea,
  Toast,
  ToastViewport,
  Tooltip,
  cn,
  useWindowSizeClass
} from '@core/design-system'
import type { TFunction } from 'i18next'
import { useRef, useState, type FormEvent, type PointerEvent } from 'react'
import { useTranslation } from 'react-i18next'
import {
  type ChatEffect,
  type ChatMessageItem,
  type ChatUiState,
  ChatViewModel
} from '../presentation'
import { renderMarkdown } from './markdown'

type MobilePane = 'list' | 'chat' | 'details'
type ChatListDensity = 'full' | 'rail'
type DesktopMode = 'rail' | 'dual' | 'triple'

interface ToastItem {
  readonly id: number
  readonly text: string
}

type ChatT = TFunction<'chat'>

export default function ChatPage() {
  const { t } = useTranslation('chat')
  const viewModel = useViewModel(ChatViewModel)
  const uiState = useStateFlow(viewModel.uiState)
  const windowSizeClass = useWindowSizeClass()
  const [mobilePane, setMobilePane] = useState<MobilePane>('chat')
  const [toasts, setToasts] = useState<readonly ToastItem[]>([])

  useSharedFlow(viewModel.effects, (effect: ChatEffect) => {
    const id = Date.now()
    setToasts((items) => [...items, { id, text: effect.text }])
    window.setTimeout(() => {
      setToasts((items) => items.filter((item) => item.id !== id))
    }, 2600)
  })

  const isCompact =
    windowSizeClass.width === 'compact' ||
    (windowSizeClass.width === 'medium' && windowSizeClass.height === 'compact')

  return (
    <section className="h-[calc(100vh-5.5rem)] px-4 pb-4 md:px-6">
      <Card className="h-full overflow-hidden rounded-[2rem] shadow-xl">
        {isCompact ? (
          <CompactChatLayout
            mobilePane={mobilePane}
            onPaneChange={setMobilePane}
            state={uiState}
            t={t}
            viewModel={viewModel}
          />
        ) : (
          <DesktopChatLayout
            state={uiState}
            t={t}
            viewModel={viewModel}
            widthPx={windowSizeClass.widthPx}
          />
        )}
      </Card>

      {!isCompact && uiState.inspector && !shouldShowInspectorColumn(windowSizeClass.widthPx) && (
        <Sheet className="w-[min(100%,28rem)] animate-in slide-in-from-right-4" open side="right">
          <InspectorPane floating state={uiState} t={t} viewModel={viewModel} />
        </Sheet>
      )}

      <ToastViewport>
        {toasts.map((toast) => (
          <Toast key={toast.id} className="animate-in slide-in-from-bottom-2">
            {toast.text}
          </Toast>
        ))}
      </ToastViewport>
    </section>
  )
}

function DesktopChatLayout({
  state,
  viewModel,
  t,
  widthPx
}: {
  state: ChatUiState
  viewModel: ChatViewModel
  t: ChatT
  widthPx: number
}) {
  const mode = getDesktopMode(widthPx, Boolean(state.inspector))
  const listWidth = mode === 'rail' ? 88 : clamp(state.listPaneWidth, 280, getMaxListWidth(widthPx))
  const inspectorWidth =
    mode === 'triple' ? clamp(state.inspectorPaneWidth, 320, getMaxInspectorWidth(widthPx)) : 0
  const gridTemplateColumns =
    mode === 'triple'
      ? `${listWidth}px 6px minmax(520px,1fr) 6px ${inspectorWidth}px`
      : `${listWidth}px 6px minmax(0,1fr)`

  return (
    <div className="grid h-full min-w-0" style={{ gridTemplateColumns }}>
      <ChatListPane
        density={mode === 'rail' ? 'rail' : 'full'}
        state={state}
        t={t}
        viewModel={viewModel}
      />
      {mode === 'rail' ? (
        <div className="bg-border/60" />
      ) : (
        <ResizeHandle
          label={t('resize.list')}
          onResize={(clientX) => viewModel.setListPaneWidth(clientX - 24)}
        />
      )}
      <ConversationPane state={state} t={t} viewModel={viewModel} />
      {mode === 'triple' && (
        <>
          <ResizeHandle
            label={t('resize.details')}
            onResize={(clientX) =>
              viewModel.setInspectorPaneWidth(window.innerWidth - clientX - 24)
            }
          />
          <InspectorPane state={state} t={t} viewModel={viewModel} />
        </>
      )}
    </div>
  )
}

function CompactChatLayout({
  mobilePane,
  onPaneChange,
  state,
  viewModel,
  t
}: {
  mobilePane: MobilePane
  onPaneChange: (pane: MobilePane) => void
  state: ChatUiState
  viewModel: ChatViewModel
  t: ChatT
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex gap-2 border-b border-border p-3">
        <Button
          size="sm"
          variant={mobilePane === 'list' ? 'default' : 'outline'}
          onClick={() => onPaneChange('list')}
        >
          {t('panes.chats')}
        </Button>
        <Button
          size="sm"
          variant={mobilePane === 'chat' ? 'default' : 'outline'}
          onClick={() => onPaneChange('chat')}
        >
          {t('panes.thread')}
        </Button>
        <Button
          disabled={!state.inspector}
          size="sm"
          variant={mobilePane === 'details' ? 'default' : 'outline'}
          onClick={() => onPaneChange('details')}
        >
          {t('panes.details')}
        </Button>
      </div>

      {mobilePane === 'list' && (
        <ChatListPane
          state={state}
          t={t}
          viewModel={viewModel}
          onSelected={() => onPaneChange('chat')}
        />
      )}
      {mobilePane === 'chat' && (
        <ConversationPane
          state={state}
          t={t}
          viewModel={viewModel}
          onMessageSelected={() => onPaneChange('details')}
        />
      )}
      {mobilePane === 'details' && <InspectorPane state={state} t={t} viewModel={viewModel} />}
    </div>
  )
}

function ChatListPane({
  state,
  viewModel,
  t,
  onSelected,
  density = 'full'
}: {
  state: ChatUiState
  viewModel: ChatViewModel
  t: ChatT
  onSelected?: () => void
  density?: ChatListDensity
}) {
  const rail = density === 'rail'

  return (
    <aside className="flex min-h-0 min-w-0 flex-col border-r border-border bg-surface/70">
      <div className={cn('space-y-4 border-b border-border p-4', rail && 'p-2')}>
        <div>
          {rail ? (
            <Avatar className="mx-auto bg-primary text-primary-foreground" fallback="K" />
          ) : (
            <>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">
                {t('eyebrow')}
              </p>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight">{t('title')}</h1>
            </>
          )}
        </div>
        {!rail && (
          <Input
            aria-label={t('search.label')}
            placeholder={t('search.placeholder')}
            type="search"
            value={state.query}
            onChange={(event) => viewModel.setQuery(event.target.value)}
          />
        )}
      </div>

      <ScrollArea className={cn('min-h-0 flex-1 p-3', rail && 'p-2')}>
        <div className="grid gap-2">
          {state.chats.map((chat) => (
            <button
              key={chat.id}
              className={cn(
                'group grid grid-cols-[auto_minmax(0,1fr)_auto] gap-3 rounded-2xl border p-3 text-left transition hover:-translate-y-0.5 hover:bg-muted/70',
                rail && 'grid-cols-1 justify-items-center gap-1 rounded-3xl px-2 py-3',
                chat.selected
                  ? 'border-primary bg-primary/10 shadow-sm'
                  : 'border-transparent bg-transparent'
              )}
              onClick={() => {
                viewModel.selectChat(chat.id)
                onSelected?.()
              }}
              type="button"
            >
              <span className="relative">
                <Avatar className={chat.avatarColor} fallback={chat.avatar} />
                {rail && chat.unreadCount > 0 && (
                  <Badge className="absolute -right-2 -top-2 px-1.5 py-0.5" variant="success">
                    {chat.unreadCount}
                  </Badge>
                )}
              </span>
              {!rail && (
                <>
                  <span className="min-w-0">
                    <span className="flex items-center gap-2">
                      <strong className="truncate text-sm">{chat.title}</strong>
                      {chat.pinned && <Badge variant="info">{t('chatList.pinned')}</Badge>}
                    </span>
                    <span className="mt-1 block truncate text-sm text-muted-foreground">
                      {chat.preview}
                    </span>
                  </span>
                  <span className="grid justify-items-end gap-2">
                    <span className="text-xs text-muted-foreground">{chat.lastMessageAt}</span>
                    {chat.unreadCount > 0 ? (
                      <Badge variant="success">{chat.unreadCount}</Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">{t('chatList.read')}</span>
                    )}
                  </span>
                </>
              )}
              {rail && (
                <span className="max-w-full truncate text-[0.65rem] text-muted-foreground">
                  {chat.avatar}
                </span>
              )}
            </button>
          ))}
        </div>
      </ScrollArea>
    </aside>
  )
}

function ConversationPane({
  state,
  viewModel,
  t,
  onMessageSelected
}: {
  state: ChatUiState
  viewModel: ChatViewModel
  t: ChatT
  onMessageSelected?: () => void
}) {
  if (!state.activeChat) {
    return <Empty>{t('empty.noChat')}</Empty>
  }

  return (
    <main className="flex min-h-0 min-w-0 flex-col bg-background">
      <header className="flex min-w-0 items-center justify-between gap-3 border-b border-border px-4 py-4 md:px-5">
        <div className="min-w-0">
          <h2 className="text-xl font-semibold">{state.activeChat.title}</h2>
          <p className="truncate text-sm text-muted-foreground">
            {state.participants.map((participant) => participant.name).join(', ')}
          </p>
        </div>
        <Tooltip className="hidden shrink-0 lg:inline-flex">{t('tips.doubleClick')}</Tooltip>
      </header>

      <ScrollArea className="min-h-0 flex-1 px-4 py-5">
        <div className="mx-auto grid w-full max-w-4xl gap-4">
          {state.messages.map((message) => (
            <MessageBubble
              key={message.id}
              message={message}
              onSelected={onMessageSelected}
              selected={state.selectedMessageId === message.id}
              t={t}
              viewModel={viewModel}
            />
          ))}
        </div>
      </ScrollArea>

      <Composer state={state} t={t} viewModel={viewModel} />
    </main>
  )
}

function MessageBubble({
  message,
  onSelected,
  selected,
  viewModel,
  t
}: {
  message: ChatMessageItem
  onSelected?: () => void
  selected: boolean
  viewModel: ChatViewModel
  t: ChatT
}) {
  return (
    <article
      className={cn(
        'group grid animate-in fade-in-50 gap-2 transition',
        message.mine ? 'justify-items-end' : 'justify-items-start'
      )}
      onDoubleClick={() => {
        viewModel.selectMessage(message.id)
        onSelected?.()
      }}
    >
      <div
        className={cn(
          'flex max-w-[min(42rem,100%)] gap-3',
          message.mine && 'flex-row-reverse',
          selected && 'rounded-3xl ring-2 ring-primary/50'
        )}
      >
        <Avatar className={message.authorColor} fallback={message.authorAvatar} />
        <div
          className={cn(
            'rounded-3xl border px-4 py-3 shadow-sm transition group-hover:-translate-y-0.5',
            message.mine
              ? 'border-primary/30 bg-primary text-primary-foreground'
              : 'border-border bg-surface text-surface-foreground'
          )}
        >
          <div className="mb-2 flex items-center gap-2 text-xs opacity-80">
            <strong>{message.authorName}</strong>
            <span>{message.createdAt}</span>
            <span>{message.read ? '✓✓' : '✓'}</span>
          </div>
          {message.replyTo && (
            <div className="mb-2 rounded-2xl border border-current/20 px-3 py-2 text-xs opacity-80">
              <strong>{message.replyTo.authorName}</strong>
              <p className="line-clamp-2">{message.replyTo.body}</p>
            </div>
          )}
          <div
            className={cn(
              'prose prose-sm max-w-none',
              message.mine ? 'text-primary-foreground' : 'text-surface-foreground'
            )}
            dangerouslySetInnerHTML={{ __html: renderMarkdown(message.body) }}
          />
          {message.reactions.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {message.reactions.map((reaction) => (
                <button
                  key={reaction.emoji}
                  className={cn(
                    'rounded-full border border-current/20 px-2 py-1 text-xs transition hover:scale-105',
                    reaction.reactedByMe && 'bg-background/20'
                  )}
                  onClick={() => viewModel.toggleReaction(message.id, reaction.emoji)}
                  type="button"
                >
                  {reaction.emoji} {reaction.count}
                </button>
              ))}
            </div>
          )}
          {message.replies.length > 0 && (
            <div className="mt-3 grid gap-2 border-l border-current/25 pl-3">
              {message.replies.map((reply) => (
                <p key={reply.id} className="text-xs opacity-85">
                  <strong>{reply.authorName}:</strong> {reply.body}
                </p>
              ))}
            </div>
          )}
          <div className="mt-3 flex flex-wrap gap-2 opacity-0 transition group-hover:opacity-100">
            {['👍', '🔥', '❤️'].map((emoji) => (
              <button
                key={emoji}
                className="rounded-full border border-current/20 px-2 py-1 text-xs"
                onClick={() => viewModel.toggleReaction(message.id, emoji)}
                type="button"
              >
                {emoji}
              </button>
            ))}
            <button
              className="rounded-full border border-current/20 px-2 py-1 text-xs"
              onClick={() => viewModel.startReply(message.id)}
              type="button"
            >
              {t('actions.reply')}
            </button>
          </div>
        </div>
      </div>
    </article>
  )
}

function Composer({
  state,
  viewModel,
  t
}: {
  state: ChatUiState
  viewModel: ChatViewModel
  t: ChatT
}) {
  const [body, setBody] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  function submit(event: FormEvent) {
    event.preventDefault()
    viewModel.sendMessage(body)
    setBody('')
    textareaRef.current?.focus()
  }

  return (
    <form className="border-t border-border bg-surface/70 p-4" onSubmit={submit}>
      {state.replyTarget && (
        <div className="mb-3 flex min-w-0 items-center justify-between gap-3 rounded-2xl border border-border bg-background px-4 py-3 text-sm">
          <span>
            {t('composer.replyingTo')} <strong>{state.replyTarget.authorName}</strong>:{' '}
            {state.replyTarget.body}
          </span>
          <Button size="sm" type="button" variant="ghost" onClick={() => viewModel.cancelReply()}>
            {t('actions.cancel')}
          </Button>
        </div>
      )}
      <div className="flex items-end gap-3">
        <Textarea
          ref={textareaRef}
          className="max-h-40 min-h-12 flex-1 resize-none rounded-2xl"
          placeholder={t('composer.placeholder')}
          value={body}
          onChange={(event) => setBody(event.target.value)}
        />
        <Button className="rounded-2xl" disabled={!body.trim()} type="submit">
          {t('actions.send')}
        </Button>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        <Kbd>**bold**</Kbd> <Kbd>_italic_</Kbd> <Kbd>`code`</Kbd>
      </p>
    </form>
  )
}

function InspectorPane({
  state,
  viewModel,
  t,
  floating = false
}: {
  state: ChatUiState
  viewModel: ChatViewModel
  t: ChatT
  floating?: boolean
}) {
  if (!state.inspector) {
    return (
      <aside className={cn('min-h-0 bg-surface p-4', !floating && 'border-l border-border')}>
        <Empty>{t('empty.noMessage')}</Empty>
      </aside>
    )
  }

  const { message, readBy, reactions, canDelete } = state.inspector

  return (
    <aside
      className={cn(
        'min-h-0 min-w-0 overflow-hidden bg-surface',
        floating ? 'h-full' : 'border-l border-border'
      )}
    >
      <ScrollArea className="h-full p-5">
        <div className="grid gap-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <Badge variant="info">{t('details.title')}</Badge>
              <h3 className="mt-3 text-2xl font-semibold">{message.authorName}</h3>
              <p className="text-sm text-muted-foreground">{message.createdAt}</p>
            </div>
            <Button
              aria-label={t('actions.close')}
              className="rounded-full"
              onClick={() => viewModel.closeInspector()}
              size="icon"
              type="button"
              variant="ghost"
            >
              ×
            </Button>
          </div>

          <Card className="bg-background shadow-none">
            <CardContent>
              <div dangerouslySetInnerHTML={{ __html: renderMarkdown(message.body) }} />
            </CardContent>
          </Card>

          <section>
            <h4 className="mb-3 font-semibold">{t('details.readBy')}</h4>
            <div className="grid gap-2">
              {readBy.map((user) => (
                <div key={user.id} className="flex items-center gap-3 rounded-xl bg-background p-2">
                  <Avatar className={user.color} fallback={user.initials} />
                  <span className="text-sm">{user.name}</span>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h4 className="mb-3 font-semibold">{t('details.reactions')}</h4>
            <div className="flex flex-wrap gap-2">
              {reactions.length === 0 && (
                <p className="text-sm text-muted-foreground">{t('details.noReactions')}</p>
              )}
              {reactions.map((reaction) => (
                <Badge key={reaction.emoji} variant={reaction.reactedByMe ? 'success' : 'default'}>
                  {reaction.emoji} {reaction.users.join(', ')}
                </Badge>
              ))}
            </div>
          </section>

          <Separator />

          <div className="grid gap-2">
            <Button onClick={() => viewModel.startReply(message.id)}>{t('actions.reply')}</Button>
            <div className="flex gap-2">
              {['👍', '🔥', '❤️'].map((emoji) => (
                <Button
                  key={emoji}
                  size="sm"
                  variant="outline"
                  onClick={() => viewModel.toggleReaction(message.id, emoji)}
                >
                  {emoji}
                </Button>
              ))}
            </div>
            <Button
              disabled={!canDelete}
              variant="destructive"
              onClick={() => viewModel.deleteMessage(message.id)}
            >
              {t('actions.delete')}
            </Button>
          </div>
        </div>
      </ScrollArea>
    </aside>
  )
}

function ResizeHandle({ label, onResize }: { label: string; onResize: (clientX: number) => void }) {
  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    event.currentTarget.setPointerCapture(event.pointerId)
    const move = (moveEvent: globalThis.PointerEvent) => onResize(moveEvent.clientX)
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  return (
    <div
      aria-label={label}
      className="group grid cursor-col-resize place-items-center bg-border/60 transition hover:bg-primary/40"
      onPointerDown={handlePointerDown}
      role="separator"
    >
      <span className="h-10 w-1 rounded-full bg-muted-foreground/30 transition group-hover:bg-primary" />
    </div>
  )
}

function getDesktopMode(widthPx: number, hasInspector: boolean): DesktopMode {
  if (widthPx < 1100) return 'rail'
  if (!hasInspector) return 'dual'
  return shouldShowInspectorColumn(widthPx) ? 'triple' : 'dual'
}

function shouldShowInspectorColumn(widthPx: number): boolean {
  return widthPx >= 1480
}

function getMaxListWidth(widthPx: number): number {
  return widthPx >= 1480 ? 420 : 340
}

function getMaxInspectorWidth(widthPx: number): number {
  return widthPx >= 1720 ? 460 : 380
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}
