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
  readonly onOpen: (roomId: string) => void
  readonly t: VoiceT
}

export function RecentRoomsCard({ rooms, onOpen, t }: RecentRoomsCardProps) {
  if (rooms.length === 0) {
    return null
  }

  return (
    <Card className="rounded-2xl border-border/70 bg-surface shadow-sm shadow-black/5">
      <CardContent className="grid gap-3 p-4 sm:p-5">
        <div>
          <h2 className="text-sm font-semibold text-foreground">{t('home.recentTitle')}</h2>
          <p className="mt-1 text-xs text-muted-foreground">{t('home.recentDescription')}</p>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          {rooms.map((room) => (
            <button
              key={room.roomId}
              className="group flex min-w-0 items-center justify-between gap-3 rounded-xl border border-border bg-background px-3 py-2 text-left transition hover:border-primary/60 hover:bg-accent"
              type="button"
              onClick={() => onOpen(room.roomId)}
            >
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold text-foreground">
                  {room.roomId}
                </span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  {formatRecentVisit(room.visitedAt)}
                </span>
              </span>
              <span className="shrink-0 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-primary">
                {'>'}
              </span>
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
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
