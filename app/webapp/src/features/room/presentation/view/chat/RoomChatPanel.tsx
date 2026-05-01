import {
  memo,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
  type UIEvent
} from 'react'
import type { TFunction } from 'i18next'
import { renderMarkdown, type ChatMessage } from '@kvatum/chat-sdk'
import {
  Button,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuReactionBar,
  ContextMenuRoot,
  ContextMenuSeparator,
  Textarea,
  cn,
  type ContextMenuPosition
} from '@core/design-system'
import type { RoomChatState } from '../../model/RoomState'

type VoiceT = TFunction<'voice'>
const defaultReactions = ['👍', '❤️', '😂', '🔥', '👀'] as const

export interface RoomChatPanelProps {
  readonly chat: RoomChatState
  readonly localParticipantId: string | null
  readonly onDraftChange: (value: string) => void
  readonly onDelete: (messageId: string) => void
  readonly onEdit: (messageId: string) => void
  readonly onEditCancel: () => void
  readonly onEditDraftChange: (value: string) => void
  readonly onEditSubmit: (messageId: string) => void
  readonly onReply: (messageId: string) => void
  readonly onReplyCancel: () => void
  readonly onReplyPreview: (messageId: string) => void
  readonly onReaction: (messageId: string, emoji: string) => void
  readonly onSend: () => void
  readonly onLatestVisible: () => void
  readonly onFileSelected: (file: File) => void
  readonly t: VoiceT
}

export const RoomChatPanel = memo(function RoomChatPanel({
  chat,
  localParticipantId,
  onDraftChange,
  onDelete,
  onEdit,
  onEditCancel,
  onEditDraftChange,
  onEditSubmit,
  onReply,
  onReplyCancel,
  onReplyPreview,
  onReaction,
  onSend,
  onLatestVisible,
  onFileSelected,
  t
}: RoomChatPanelProps) {
  const messagesRef = useRef<HTMLDivElement | null>(null)
  const draftRef = useRef<HTMLTextAreaElement | null>(null)
  const onLatestVisibleRef = useRef(onLatestVisible)
  const wasAtBottomRef = useRef(true)
  const [atBottom, setAtBottom] = useState(true)
  const [contextMenu, setContextMenu] = useState<{
    readonly messageId: string
    readonly position: ContextMenuPosition
  } | null>(null)
  const visibleLastReadMessageId = chat.open && atBottom ? null : chat.lastReadMessageId
  const replyTarget = useMemo(
    () => findReplyTarget(chat.messages, chat.replyToId),
    [chat.messages, chat.replyToId]
  )
  const rows = useMemo(
    () => buildRows(chat.messages, visibleLastReadMessageId),
    [chat.messages, visibleLastReadMessageId]
  )
  const latestMessageId = chat.messages.at(-1)?.id ?? null

  useEffect(() => {
    onLatestVisibleRef.current = onLatestVisible
  }, [onLatestVisible])

  useEffect(() => {
    const node = messagesRef.current
    if (!node) {
      return
    }
    if (wasAtBottomRef.current) {
      node.scrollTop = node.scrollHeight
      onLatestVisibleRef.current()
    }
  }, [chat.messages.length, chat.open])

  useEffect(() => {
    if (chat.open && atBottom && latestMessageId && latestMessageId !== chat.lastReadMessageId) {
      onLatestVisibleRef.current()
    }
  }, [atBottom, chat.lastReadMessageId, chat.open, latestMessageId])

  useEffect(() => {
    if (!chat.highlightedMessageId) {
      return
    }

    const node = messagesRef.current?.querySelector<HTMLElement>(
      `[data-message-id="${CSS.escape(chat.highlightedMessageId)}"]`
    )
    node?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [chat.highlightedMessageId])

  useEffect(() => {
    if (!chat.replyToId) {
      return
    }
    requestAnimationFrame(() => draftRef.current?.focus())
  }, [chat.replyToId])

  function submit(event: FormEvent) {
    event.preventDefault()
    onSend()
  }

  function handleDraftKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) {
      return
    }
    event.preventDefault()
    onSend()
  }

  function selectFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (file) {
      onFileSelected(file)
    }
    event.target.value = ''
  }

  function handleMessagesScroll(event: UIEvent<HTMLDivElement>) {
    const node = event.currentTarget
    const nextAtBottom = node.scrollHeight - node.scrollTop - node.clientHeight < 32
    wasAtBottomRef.current = nextAtBottom
    setAtBottom((current) => (current === nextAtBottom ? current : nextAtBottom))
  }

  return (
    <aside className="animate-panel-in grid h-full min-h-0 w-full self-stretch overflow-hidden rounded-lg border border-border bg-surface text-foreground shadow-2xl lg:w-[25rem] xl:w-[29rem]">
      <div className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)_auto]">
        <div className="border-b border-border px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold">{t('room.chat.title')}</h2>
            {chat.status !== 'connected' && (
              <span className="rounded-full bg-muted px-2 py-1 text-[0.68rem] uppercase tracking-wide text-muted-foreground">
                {chat.status}
              </span>
            )}
          </div>
          {chat.error && <p className="mt-1 text-xs text-destructive">{chat.error}</p>}
        </div>

        <div
          ref={messagesRef}
          className="min-h-0 overflow-auto overscroll-contain px-0 py-3"
          onScroll={handleMessagesScroll}
        >
          {chat.messages.length === 0 ? (
            <div className="grid min-h-48 place-items-center text-center text-sm text-muted-foreground">
              {t('room.chat.empty')}
            </div>
          ) : (
            <div className="grid gap-0">
              {rows.map((row) => {
                if (row.type === 'date') {
                  return <DateDivider key={row.id} label={row.label} />
                }
                if (row.type === 'new') {
                  return <NewMessagesDivider key={row.id} label={t('room.chat.newMessages')} />
                }
                return (
                  <MessageRow
                    key={row.message.id}
                    compact={row.compact}
                    editing={chat.editingMessageId === row.message.id}
                    editingDraft={chat.editingDraft}
                    highlighted={chat.highlightedMessageId === row.message.id}
                    localParticipantId={localParticipantId}
                    message={row.message}
                    replyTarget={findReplyTarget(chat.messages, row.message.replyToId)}
                    t={t}
                    onContextMenu={(messageId, position) => setContextMenu({ messageId, position })}
                    onDelete={onDelete}
                    onEdit={onEdit}
                    onEditCancel={onEditCancel}
                    onEditDraftChange={onEditDraftChange}
                    onEditSubmit={onEditSubmit}
                    onReply={onReply}
                    onReplyPreview={onReplyPreview}
                  />
                )
              })}
            </div>
          )}
        </div>

        <form className="border-t border-border p-3" onSubmit={submit}>
          {replyTarget && (
            <div className="mb-2 grid gap-1 rounded-md border-l-2 border-primary bg-muted px-3 py-2 text-xs text-muted-foreground">
              <div className="flex items-center justify-between gap-2">
                <span className="min-w-0 truncate font-medium text-primary">
                  {t('room.chat.reply')}: {replyTarget.author.displayName}
                </span>
                <button
                  className="shrink-0 text-muted-foreground hover:text-foreground"
                  type="button"
                  onClick={onReplyCancel}
                >
                  {t('room.chat.cancelReply')}
                </button>
              </div>
              <span className="line-clamp-2 text-muted-foreground">{replyPreview(replyTarget)}</span>
            </div>
          )}

          <div className="grid gap-2">
            {chat.pendingAttachments.length > 0 && (
              <div className="grid gap-1">
                {chat.pendingAttachments.map((attachment) => (
                  <AttachmentChip key={attachment.id} attachment={attachment} />
                ))}
              </div>
            )}

            <Textarea
              ref={draftRef}
              className="max-h-36 min-h-16 resize-none rounded-md border-border bg-muted text-foreground placeholder:text-muted-foreground"
              placeholder={t('room.chat.placeholder')}
              value={chat.draft}
              onChange={(event) => onDraftChange(event.target.value)}
              onKeyDown={handleDraftKeyDown}
            />

            <div className="flex items-center gap-2">
              <label className="inline-flex h-10 cursor-pointer items-center rounded-md bg-muted px-3 text-sm text-foreground hover:bg-accent">
                <input className="sr-only" type="file" onChange={selectFile} />
                Файл
              </label>
              <Button
                className="flex-1 rounded-md"
                disabled={!chat.draft.trim() && chat.pendingAttachments.length === 0}
                type="submit"
              >
                {t('room.chat.send')}
              </Button>
            </div>

            <p className="px-2 text-[0.68rem] text-muted-foreground">
              Enter - отправить, Shift+Enter - новая строка
            </p>
          </div>
        </form>
      </div>
      <MessageContextMenu
        localParticipantId={localParticipantId}
        menu={contextMenu}
        messages={chat.messages}
        onClose={() => setContextMenu(null)}
        onDelete={onDelete}
        onEdit={onEdit}
        onReaction={onReaction}
        onReply={onReply}
      />
    </aside>
  )
}, areRoomChatPanelPropsEqual)

type Row =
  | { readonly type: 'date'; readonly id: string; readonly label: string }
  | { readonly type: 'new'; readonly id: string }
  | { readonly type: 'message'; readonly message: ChatMessage; readonly compact: boolean }

type MessageRowProps = {
  readonly message: ChatMessage
  readonly compact: boolean
  readonly editing: boolean
  readonly editingDraft: string
  readonly highlighted: boolean
  readonly localParticipantId: string | null
  readonly replyTarget: ChatMessage | null
  readonly onContextMenu: (messageId: string, position: ContextMenuPosition) => void
  readonly onDelete: (messageId: string) => void
  readonly onEdit: (messageId: string) => void
  readonly onEditCancel: () => void
  readonly onEditDraftChange: (value: string) => void
  readonly onEditSubmit: (messageId: string) => void
  readonly onReply: (messageId: string) => void
  readonly onReplyPreview: (messageId: string) => void
  readonly t: VoiceT
}

function areRoomChatPanelPropsEqual(
  previous: RoomChatPanelProps,
  next: RoomChatPanelProps
): boolean {
  return (
    previous.chat === next.chat &&
    previous.localParticipantId === next.localParticipantId &&
    previous.t === next.t
  )
}

function buildRows(messages: readonly ChatMessage[], lastReadMessageId: string | null): Row[] {
  const rows: Row[] = []
  let previousAuthorId: string | null = null
  let previousDay: string | null = null
  let insertedNewDivider = false
  let lastReadSeen = !lastReadMessageId

  for (const message of messages) {
    const day = new Date(message.createdAt).toDateString()
    if (day !== previousDay) {
      rows.push({ type: 'date', id: `date:${day}`, label: formatDay(message.createdAt) })
      previousDay = day
      previousAuthorId = null
    }

    if (message.id === lastReadMessageId) {
      lastReadSeen = true
    } else if (!insertedNewDivider && lastReadSeen && lastReadMessageId) {
      rows.push({ type: 'new', id: `new:${message.id}` })
      insertedNewDivider = true
      previousAuthorId = null
    }

    const startsReplyGroup = Boolean(message.replyToId)
    rows.push({
      type: 'message',
      message,
      compact: !startsReplyGroup && previousAuthorId === message.author.id
    })
    previousAuthorId = message.author.id
  }

  return rows
}

const MessageRow = memo(function MessageRow({
  message,
  compact,
  editing,
  editingDraft,
  highlighted,
  localParticipantId,
  replyTarget,
  onContextMenu,
  onDelete,
  onEdit,
  onEditCancel,
  onEditDraftChange,
  onEditSubmit,
  onReply,
  onReplyPreview,
  t
}: MessageRowProps) {
  const mine = message.author.id === localParticipantId
  const deleted = Boolean(message.deletedAt)

  return (
    <div
      data-message-id={message.id}
      className={cn(
        'group relative grid grid-cols-[2.5rem_minmax(0,1fr)] gap-1.5 px-3 py-1 transition-colors hover:bg-accent',
        compact && 'py-0',
        highlighted && 'bg-primary/15 ring-1 ring-primary/40'
      )}
      onContextMenu={(event) => {
        event.preventDefault()
        if (!deleted && !message.pending) {
          onContextMenu(message.id, { x: event.clientX, y: event.clientY })
        }
      }}
    >
      <div className="pt-0.5">
        {!compact && (
          <div className="grid size-9 place-items-center rounded-full bg-muted text-sm font-semibold text-foreground">
            {message.author.displayName.slice(0, 1).toUpperCase()}
          </div>
        )}
      </div>
      <div className="min-w-0 py-0.5">
        {!compact && (
          <div className="flex min-w-0 items-baseline gap-2">
            <p
              className={cn(
                'truncate text-sm font-semibold',
                mine ? 'text-primary' : 'text-accent-foreground'
              )}
            >
              {message.author.displayName}
            </p>
            <time className="text-[0.7rem] text-muted-foreground">
              {formatTime(message.createdAt)}
            </time>
            {message.pending && (
              <span className="text-[0.7rem] text-muted-foreground">sending</span>
            )}
            {message.editedAt && (
              <span className="text-[0.7rem] text-muted-foreground">
                {t('room.chat.edited')}
              </span>
            )}
          </div>
        )}

        {replyTarget && (
          <button
            className={cn(
              'flex min-w-0 items-center gap-1.5 rounded-md py-0.5 pr-2 text-left text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground',
              compact ? 'mb-0.5' : 'mb-1'
            )}
            onClick={() => onReplyPreview(replyTarget.id)}
            type="button"
          >
            <span className="h-px w-5 shrink-0 bg-border" />
            <span className="grid size-4 shrink-0 place-items-center rounded-full bg-muted text-[0.58rem] text-foreground">
              {replyTarget.author.displayName.slice(0, 1).toUpperCase()}
            </span>
            <span className="shrink-0 font-semibold text-primary">
              @{replyTarget.author.displayName}
            </span>
            <span className="min-w-0 truncate">{replyPreview(replyTarget)}</span>
          </button>
        )}

        {editing ? (
          <EditMessageForm
            draft={editingDraft}
            messageId={message.id}
            onCancel={onEditCancel}
            onChange={onEditDraftChange}
            onSubmit={onEditSubmit}
          />
        ) : (
          <div
            className={cn(
              'chat-markdown max-w-none break-words text-[0.94rem] leading-5 text-foreground [&_a]:text-primary [&_blockquote]:border-l-2 [&_blockquote]:border-primary/50 [&_blockquote]:pl-2 [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_h1]:text-base [&_h1]:font-semibold [&_h2]:text-sm [&_h2]:font-semibold [&_li]:ml-4 [&_li]:list-disc [&_p]:my-0 [&_strong]:font-semibold',
              deleted && 'italic text-muted-foreground'
            )}
            dangerouslySetInnerHTML={{
              __html: deleted ? 'Сообщение удалено.' : renderMarkdown(message.bodyMarkdown)
            }}
          />
        )}

        {message.linkPreviews.map((preview) => (
          <a
            key={preview.url}
            className="mt-2 block rounded-md border border-border bg-muted p-3 text-xs text-muted-foreground hover:bg-accent"
            href={preview.url}
            rel="noreferrer"
            target="_blank"
          >
            <span className="block truncate font-semibold text-foreground">
              {preview.title || preview.url}
            </span>
            {preview.description && (
              <span className="mt-1 line-clamp-2 block">{preview.description}</span>
            )}
          </a>
        ))}

        {message.attachments.length > 0 && (
          <div className="mt-2 grid gap-2">
            {message.attachments.map((attachment) => (
              <AttachmentPreview key={attachment.id} attachment={attachment} />
            ))}
          </div>
        )}

        <div className="mt-0.5 flex flex-wrap items-center gap-1 opacity-75 transition group-hover:opacity-100">
          {Object.entries(message.reactions ?? {}).map(([emoji, users]) => (
            <span
              key={emoji}
              className={cn(
                'rounded-full bg-muted px-2 py-0.5 text-xs',
                users.includes(localParticipantId ?? '') && 'bg-primary/70 text-primary-foreground'
              )}
            >
              {emoji} {users.length}
            </span>
          ))}
        </div>
      </div>
      {!deleted && !message.pending && !editing && (
        <MessageActionRail
          mine={mine}
          messageId={message.id}
          onDelete={onDelete}
          onEdit={onEdit}
          onReply={onReply}
          t={t}
        />
      )}
    </div>
  )
}, areMessageRowPropsEqual)

function areMessageRowPropsEqual(previous: MessageRowProps, next: MessageRowProps): boolean {
  return (
    previous.message === next.message &&
    previous.compact === next.compact &&
    previous.editing === next.editing &&
    previous.editingDraft === next.editingDraft &&
    previous.highlighted === next.highlighted &&
    previous.localParticipantId === next.localParticipantId &&
    previous.replyTarget === next.replyTarget &&
    previous.t === next.t
  )
}

function MessageActionRail({
  messageId,
  mine,
  onDelete,
  onEdit,
  onReply,
  t
}: {
  readonly messageId: string
  readonly mine: boolean
  readonly onDelete: (messageId: string) => void
  readonly onEdit: (messageId: string) => void
  readonly onReply: (messageId: string) => void
  readonly t: VoiceT
}) {
  return (
    <div className="absolute right-2 top-0 hidden -translate-y-1/2 items-center gap-1 rounded-md border border-border bg-surface p-1 shadow-md group-hover:flex">
      <IconAction label={t('room.chat.reply')} onClick={() => onReply(messageId)}>
        <ReplyIcon />
      </IconAction>
      {mine && (
        <>
          <IconAction label="Редактировать" onClick={() => onEdit(messageId)}>
            <EditIcon />
          </IconAction>
          <IconAction destructive label="Удалить" onClick={() => onDelete(messageId)}>
            <DeleteIcon />
          </IconAction>
        </>
      )}
    </div>
  )
}

function MessageContextMenu({
  localParticipantId,
  menu,
  messages,
  onClose,
  onDelete,
  onEdit,
  onReaction,
  onReply
}: {
  readonly localParticipantId: string | null
  readonly menu: { readonly messageId: string; readonly position: ContextMenuPosition } | null
  readonly messages: readonly ChatMessage[]
  readonly onClose: () => void
  readonly onDelete: (messageId: string) => void
  readonly onEdit: (messageId: string) => void
  readonly onReaction: (messageId: string, emoji: string) => void
  readonly onReply: (messageId: string) => void
}) {
  const message = menu ? messages.find((item) => item.id === menu.messageId) : null
  const mine = Boolean(message && message.author.id === localParticipantId)

  return (
    <ContextMenuRoot open={Boolean(menu && message)} onClose={onClose}>
      {menu && message && (
        <ContextMenuContent position={menu.position}>
          <ContextMenuReactionBar
            reactions={defaultReactions}
            onReaction={(emoji) => {
              onReaction(message.id, emoji)
              onClose()
            }}
          />
          <ContextMenuSeparator />
          <ContextMenuItem
            onClick={() => {
              onReply(message.id)
              onClose()
            }}
          >
            <ReplyIcon />
            Ответить
          </ContextMenuItem>
          {mine && (
            <>
              <ContextMenuItem
                onClick={() => {
                  onEdit(message.id)
                  onClose()
                }}
              >
                <EditIcon />
                Редактировать
              </ContextMenuItem>
              <ContextMenuItem
                destructive
                onClick={() => {
                  onDelete(message.id)
                  onClose()
                }}
              >
                <DeleteIcon />
                Удалить
              </ContextMenuItem>
            </>
          )}
        </ContextMenuContent>
      )}
    </ContextMenuRoot>
  )
}

function EditMessageForm({
  draft,
  messageId,
  onCancel,
  onChange,
  onSubmit
}: {
  readonly draft: string
  readonly messageId: string
  readonly onCancel: () => void
  readonly onChange: (value: string) => void
  readonly onSubmit: (messageId: string) => void
}) {
  return (
    <div className="grid gap-1">
      <Textarea
        className="max-h-32 min-h-12 resize-none rounded-md border-border bg-muted text-foreground"
        value={draft}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault()
            onCancel()
          }
          if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
            event.preventDefault()
            onSubmit(messageId)
          }
        }}
      />
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <button className="text-primary hover:underline" type="button" onClick={() => onSubmit(messageId)}>
          сохранить
        </button>
        <button className="hover:text-foreground" type="button" onClick={onCancel}>
          отменить
        </button>
      </div>
    </div>
  )
}

function IconAction({
  children,
  destructive = false,
  label,
  onClick
}: {
  readonly children: ReactNode
  readonly destructive?: boolean
  readonly label: string
  readonly onClick: () => void
}) {
  return (
    <button
      aria-label={label}
      className={cn(
        'grid size-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground',
        destructive && 'hover:bg-destructive/10 hover:text-destructive'
      )}
      title={label}
      type="button"
      onClick={onClick}
    >
      {children}
    </button>
  )
}

function ReplyIcon() {
  return (
    <svg aria-hidden="true" className="size-4" fill="none" viewBox="0 0 24 24">
      <path
        d="m9 8-4 4 4 4M5 12h9a5 5 0 0 1 5 5v1"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  )
}

function EditIcon() {
  return (
    <svg aria-hidden="true" className="size-4" fill="none" viewBox="0 0 24 24">
      <path
        d="m4 20 4.8-1 10-10a2.1 2.1 0 0 0-3-3l-10 10L4 20Z"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  )
}

function DeleteIcon() {
  return (
    <svg aria-hidden="true" className="size-4" fill="none" viewBox="0 0 24 24">
      <path
        d="M5 7h14M10 11v6M14 11v6M8 7l1-3h6l1 3M7 7l1 13h8l1-13"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  )
}

function AttachmentChip({ attachment }: { readonly attachment: ChatMessage['attachments'][number] }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
      <span className="min-w-0 truncate">{attachment.fileName}</span>
      <span className="shrink-0 text-muted-foreground">{attachment.status}</span>
    </div>
  )
}

function AttachmentPreview({
  attachment
}: {
  readonly attachment: ChatMessage['attachments'][number]
}) {
  if (attachment.kind === 'image') {
    return (
      <a href={attachment.url} rel="noreferrer" target="_blank">
        <img
          alt={attachment.fileName}
          className="max-h-56 w-full rounded-md object-cover"
          src={attachment.previewUrl || attachment.url}
        />
      </a>
    )
  }
  if (attachment.kind === 'video') {
    return (
      <video
        className="max-h-64 w-full rounded-md bg-background"
        controls
        poster={attachment.posterUrl}
        src={attachment.url}
      />
    )
  }
  return (
    <a
      className="flex items-center justify-between gap-3 rounded-md border border-border bg-muted px-3 py-2 text-xs text-muted-foreground hover:bg-accent"
      href={attachment.url}
      rel="noreferrer"
      target="_blank"
    >
      <span className="min-w-0 truncate">{attachment.fileName}</span>
      <span className="shrink-0">{formatBytes(attachment.sizeBytes)}</span>
    </a>
  )
}

function DateDivider({ label }: { readonly label: string }) {
  return (
    <div className="flex items-center gap-3 py-3 text-xs font-semibold text-muted-foreground">
      <span className="h-px flex-1 bg-border" />
      <span>{label}</span>
      <span className="h-px flex-1 bg-border" />
    </div>
  )
}

function NewMessagesDivider({ label }: { readonly label: string }) {
  return (
    <div className="flex items-center gap-3 py-2 text-xs font-semibold text-primary">
      <span className="h-px flex-1 bg-primary/50" />
      <span>{label}</span>
      <span className="h-px flex-1 bg-primary/50" />
    </div>
  )
}

function replyPreview(message: ChatMessage): string {
  if (message.deletedAt) {
    return 'Сообщение удалено.'
  }
  return message.bodyPlain || message.bodyMarkdown || message.attachments[0]?.fileName || ''
}

function findReplyTarget(
  messages: readonly ChatMessage[],
  replyToId: string | null | undefined
): ChatMessage | null {
  if (!replyToId) {
    return null
  }
  return messages.find((message) => message.id === replyToId) ?? null
}

function formatDay(value: string): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(value))
}

function formatTime(value: string): string {
  return new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' }).format(
    new Date(value)
  )
}

function formatBytes(value: number): string {
  if (value < 1024) return `${value} B`
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`
  return `${Math.round(value / 1024 / 1024)} MB`
}
