import { memo, useRef, type ReactNode } from 'react'
import type { TFunction } from 'i18next'
import { Badge, Card, cn } from '@core/design-system'
import type { ParticipantMediaTile } from './room-tile-model'
import { CameraIcon, CameraOffIcon, MicIcon, MicOffIcon, ScreenIcon } from './room-icons'
import { ParticipantVideo } from './ParticipantVideo'

type VoiceT = TFunction<'voice'>

export interface ParticipantTileProps {
  readonly tile: ParticipantMediaTile
  readonly speaking: boolean
  readonly pinned: boolean
  readonly onPin: (tileId: string) => void
  readonly t: VoiceT
}

export const ParticipantTile = memo(function ParticipantTile({
  tile,
  speaking,
  pinned,
  onPin,
  t
}: ParticipantTileProps) {
  const fullscreenRef = useRef<HTMLDivElement | null>(null)
  const title =
    tile.kind === 'screen'
      ? t('room.participant.screenFrom', { name: tile.participant.displayName })
      : tile.participant.displayName

  return (
    <Card
      className={cn(
        'overflow-hidden rounded-lg bg-surface text-foreground shadow-none transition-all duration-300 [contain:layout_paint_style]',
        tile.kind === 'screen'
          ? 'border-border bg-surface ring-1 ring-info/25'
          : speaking
            ? 'border-primary/80 ring-2 ring-primary/45'
            : 'border-border',
        tile.kind !== 'screen' &&
          !tile.audioOn &&
          'border-destructive/45 ring-1 ring-destructive/20',
        pinned && 'md:col-span-2 xl:col-span-2'
      )}
    >
      <div
        ref={fullscreenRef}
        className={cn(
          'relative overflow-hidden bg-surface transition-all duration-300 [contain:layout_paint_style]',
          tile.kind === 'screen'
            ? pinned
              ? 'aspect-[16/9] min-h-[22rem]'
              : 'aspect-[16/9]'
            : pinned
              ? 'aspect-[16/9] min-h-[20rem]'
              : 'aspect-video',
          tile.kind === 'presence' && 'min-h-[15rem]',
          tile.kind === 'screen' && 'm-1 rounded-md border border-border bg-background'
        )}
      >
        {tile.stream ? (
          <ParticipantVideo
            muted={tile.local}
            stream={tile.stream}
            variant={tile.kind === 'screen' ? 'screen' : 'participant'}
          />
        ) : (
          <div className="grid h-full place-items-center p-6 text-center">
            <div className="relative grid place-items-center">
              <div
                className={cn(
                  'absolute size-28 rounded-full border border-primary/45 bg-primary/15 opacity-0 sm:size-36',
                  speaking && 'speaking-ring'
                )}
              />
              <div
                className={cn(
                  'absolute size-36 rounded-full border border-info/35 bg-info/10 opacity-0 sm:size-44',
                  speaking && 'speaking-ring speaking-ring-delayed'
                )}
              />
              <div className="relative mx-auto grid size-20 place-items-center rounded-full bg-muted text-3xl font-semibold text-foreground shadow-2xl ring-1 ring-border transition-transform duration-300 sm:size-24 sm:text-4xl">
                <span className={cn('inline-block transition-transform', speaking && 'scale-105')}>
                  {tile.participant.displayName.slice(0, 1).toUpperCase()}
                </span>
              </div>
              {/* {tile.awaitingMedia && (
                <p className="mt-4 max-w-64 text-sm leading-6 text-muted-foreground">
                  {t('room.participant.waitingMedia')}
                </p>
              )} */}
            </div>
          </div>
        )}

        {tile.kind === 'screen' && (
          <div className="pointer-events-none absolute inset-0 z-20 border-2 border-border" />
        )}
        {tile.kind !== 'screen' && !tile.audioOn && (
          <div className="pointer-events-none absolute inset-0 z-20 bg-destructive/10" />
        )}
        <div
          className={cn(
            'absolute inset-x-0 bottom-0 z-20 h-28 bg-linear-to-t to-background/0',
            tile.kind === 'screen' ? 'from-background/80' : 'from-background/90'
          )}
        />
        <div className="absolute left-3 right-3 top-3 z-30 flex items-start justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            {tile.kind === 'screen' && (
              <div className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-foreground shadow-lg">
                <ScreenIcon />
                <span>{t('room.participant.screen')}</span>
              </div>
            )}
            {tile.local && <Badge variant="info">{t('room.participant.you')}</Badge>}
            {pinned && <Badge variant="success">{t('room.participant.pinned')}</Badge>}
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <button
              className="rounded-full bg-muted px-3 py-1.5 text-xs font-medium text-foreground transition hover:bg-accent"
              onClick={() => onPin(tile.id)}
              type="button"
            >
              {pinned ? t('room.participant.unpin') : t('room.participant.pin')}
            </button>
            {tile.kind === 'screen' && (
              <button
                className="rounded-full bg-muted px-3 py-1.5 text-xs font-medium text-foreground transition hover:bg-accent"
                onClick={() => {
                  void fullscreenRef.current?.requestFullscreen?.()
                }}
                type="button"
              >
                {t('room.participant.fullscreen')}
              </button>
            )}
          </div>
        </div>

        <div className="absolute bottom-3 left-3 right-3 z-30 flex items-end justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            {tile.kind === 'screen' && (
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-muted text-foreground ring-1 ring-border">
                <ScreenIcon />
              </span>
            )}
            <div className="min-w-0">
              <p className="truncate text-base font-medium">{title}</p>
              <p className="truncate text-xs text-muted-foreground">
                {t(`room.participant.roles.${tile.participant.role}`)}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <StatusDot enabled={tile.audioOn} label={t('room.participant.mic')}>
              {tile.audioOn ? <MicIcon /> : <MicOffIcon />}
            </StatusDot>
            <StatusDot enabled={tile.cameraOn} label={t('room.participant.cam')}>
              {tile.cameraOn ? <CameraIcon /> : <CameraOffIcon />}
            </StatusDot>
            {tile.screenOn && (
              <StatusDot enabled label={t('room.participant.screen')}>
                <ScreenIcon />
              </StatusDot>
            )}
          </div>
        </div>
      </div>
    </Card>
  )
}, areParticipantTilePropsEqual)

function areParticipantTilePropsEqual(
  previous: ParticipantTileProps,
  next: ParticipantTileProps
): boolean {
  return (
    previous.tile.id === next.tile.id &&
    previous.tile.participant === next.tile.participant &&
    previous.tile.kind === next.tile.kind &&
    previous.tile.stream === next.tile.stream &&
    previous.tile.local === next.tile.local &&
    previous.tile.audioOn === next.tile.audioOn &&
    previous.tile.cameraOn === next.tile.cameraOn &&
    previous.tile.screenOn === next.tile.screenOn &&
    previous.tile.awaitingMedia === next.tile.awaitingMedia &&
    previous.speaking === next.speaking &&
    previous.pinned === next.pinned &&
    previous.t === next.t &&
    previous.onPin === next.onPin
  )
}

function StatusDot({
  children,
  enabled,
  label
}: {
  readonly children: ReactNode
  readonly enabled: boolean
  readonly label: string
}) {
  return (
    <span
      aria-label={label}
      className={cn(
        'inline-flex size-8 items-center justify-center rounded-full',
        enabled ? 'bg-muted text-foreground' : 'bg-destructive text-on-feedback'
      )}
      title={label}
    >
      {children}
    </span>
  )
}
