import type { TFunction } from 'i18next'
import {
  Alert,
  AlertDescription,
  Button,
  Card,
  CardContent,
  Field,
  FieldHint,
  Input
} from '@core/design-system'
import type { HomeUiState } from '../model/HomeState'
import { JoinIcon, LogoMark } from './home-icons'
import type { RecentRoom } from '../../domain/model/RecentRoom'

type VoiceT = TFunction<'voice'>

export interface CreateRoomCardProps {
  readonly enabled: boolean
  readonly onCreate: () => void
  readonly t: VoiceT
}

export function CreateRoomCard({ enabled, onCreate, t }: CreateRoomCardProps) {
  return (
    <button
      className="group grid min-h-[22rem] place-items-center rounded-[2rem] border border-border/70 bg-surface text-center shadow-xl shadow-black/8 transition hover:-translate-y-0.5 hover:bg-surface-elevated hover:shadow-2xl disabled:pointer-events-none disabled:opacity-50 md:min-h-[26rem]"
      disabled={!enabled}
      onClick={onCreate}
      type="button"
    >
      <div>
        <div className="mx-auto grid size-24 place-items-center rounded-[2rem] bg-background text-foreground transition group-hover:scale-105">
          <LogoMark />
        </div>
        <p className="mt-6 text-xl font-semibold text-foreground">{t('home.createRoom')}</p>
      </div>
    </button>
  )
}

export interface JoinRoomCardProps {
  readonly feedback: HomeUiState['feedback']
  readonly inputState: HomeUiState['idOrLinkToJoinState']
  readonly joinButtonState: HomeUiState['joinButtonState']
  readonly onInputChange: (value: string) => void
  readonly onJoin: () => void
  readonly t: VoiceT
}

export function JoinRoomCard({
  feedback,
  inputState,
  joinButtonState,
  onInputChange,
  onJoin,
  t
}: JoinRoomCardProps) {
  return (
    <Card className="rounded-[2rem] border-border/70 bg-surface shadow-xl shadow-black/8">
      <CardContent className="grid h-full content-center gap-5 p-5 sm:p-6">
        <div className="text-center">
          <div className="mx-auto grid size-20 place-items-center rounded-[1.5rem] bg-background text-foreground">
            <JoinIcon />
          </div>
          <h2 className="mt-5 text-xl font-semibold text-foreground">{t('home.joinTitle')}</h2>
        </div>

        {feedback && (
          <Alert variant="warning">
            <AlertDescription>{t(feedback)}</AlertDescription>
          </Alert>
        )}

        <Field className="gap-3">
          <Input
            aria-invalid={inputState.showError}
            className="min-h-12 rounded-2xl bg-background px-5 text-center"
            placeholder={t('home.roomInputPlaceholder')}
            type="text"
            value={inputState.value}
            onChange={(event) => onInputChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                onJoin()
              }
            }}
          />
          <Button
            className="min-h-12 rounded-2xl px-6"
            disabled={!joinButtonState.enabled || joinButtonState.loading}
            onClick={onJoin}
            type="button"
          >
            {joinButtonState.loading ? t('home.checking') : t('home.continue')}
          </Button>

          {inputState.showError ? (
            <FieldHint className="text-destructive">
              {inputState.error ? t(inputState.error) : ''}
            </FieldHint>
          ) : (
            <FieldHint className="text-center">{t('home.directJoinHint')}</FieldHint>
          )}
        </Field>
      </CardContent>
    </Card>
  )
}

export interface RecentRoomsCardProps {
  readonly rooms: readonly RecentRoom[]
  readonly onOpenChat: (roomId: string) => void
  readonly onOpen: (roomId: string) => void
  readonly t: VoiceT
}

export function RecentRoomsCard({ rooms, onOpenChat, onOpen, t }: RecentRoomsCardProps) {
  if (rooms.length === 0) {
    return null
  }

  return (
    <section className="mx-auto grid max-w-3xl gap-2 px-1">
      <h2 className="px-2 text-sm font-semibold text-muted-foreground">{t('home.recentTitle')}</h2>
      <div className="grid">
        {rooms.map((room) => (
          <div
            key={room.roomId}
            className="group grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2 rounded-lg px-2 py-2 text-left transition-colors hover:bg-accent"
          >
            <button
              className="min-w-0 truncate text-left text-sm font-medium text-foreground"
              type="button"
              onClick={() => onOpen(room.roomId)}
            >
              {room.roomId}
            </button>
            <span className="text-xs text-muted-foreground transition-colors group-hover:text-foreground">
              {formatRecentVisit(room.visitedAt)}
            </span>
            <button
              aria-label={t('home.openRecentChat')}
              className="grid size-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-primary"
              title={t('home.openRecentChat')}
              type="button"
              onClick={() => onOpenChat(room.roomId)}
            >
              <ChatIcon />
            </button>
          </div>
        ))}
      </div>
    </section>
  )
}

function ChatIcon() {
  return (
    <svg aria-hidden="true" className="size-4" fill="none" viewBox="0 0 24 24">
      <path
        d="M7.5 18.5 4 21v-4.5A8 8 0 0 1 3 12C3 7.6 7 4 12 4s9 3.6 9 8-4 8-9 8a10.4 10.4 0 0 1-4.5-1.5Z"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
      <path d="M8 11.5h8M8 14.5h5" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
    </svg>
  )
}

function formatRecentVisit(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(value))
}
