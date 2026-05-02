import { Fragment, memo, useMemo, type CSSProperties } from 'react'
import type { TFunction } from 'i18next'
import { Empty, ScrollArea, cn } from '@core/design-system'
import type { RtcMediaStreams } from '@capabilities/rtc/domain/model'
import type { Participant } from '@features/room/domain/model/Participant'
import { ParticipantAudio } from './ParticipantAudio'
import { ParticipantTile } from './ParticipantTile'
import { buildParticipantTiles, slotEnabled, type LocalParticipantSlotState } from './room-tile-model'

type VoiceT = TFunction<'voice'>

export interface ConferenceStageProps {
  readonly participants: readonly Participant[]
  readonly localParticipantId: string | null
  readonly localMediaStreams: RtcMediaStreams
  readonly remoteMediaStreams: Readonly<Record<string, RtcMediaStreams>>
  readonly localSlotState: LocalParticipantSlotState
  readonly pinnedTileId: string | null
  readonly speakingParticipantIds: readonly string[]
  readonly onPin: (tileId: string) => void
  readonly t: VoiceT
}

export const ConferenceStage = memo(function ConferenceStage({
  participants,
  localParticipantId,
  localSlotState,
  localMediaStreams,
  remoteMediaStreams,
  pinnedTileId,
  speakingParticipantIds,
  onPin,
  t
}: ConferenceStageProps) {
  const sortedTiles = useMemo(() => {
    const tiles = buildParticipantTiles(
      participants,
      localParticipantId,
      localMediaStreams,
      remoteMediaStreams,
      localSlotState
    )

    return [...tiles].sort((left, right) => {
      if (left.id === pinnedTileId) return -1
      if (right.id === pinnedTileId) return 1
      if (left.kind === 'screen' && right.kind !== 'screen') return -1
      if (right.kind === 'screen' && left.kind !== 'screen') return 1
      if (left.local !== right.local) return left.local ? -1 : 1
      return left.participant.displayName.localeCompare(right.participant.displayName)
    })
  }, [
    localMediaStreams,
    localParticipantId,
    localSlotState,
    participants,
    pinnedTileId,
    remoteMediaStreams
  ])

  if (!participants.length) {
    return (
      <Empty className="min-h-[24rem] rounded-lg bg-surface">
        <div>
          <p className="text-2xl font-medium text-foreground">{t('room.empty.title')}</p>
          <p className="mt-2 text-sm text-muted-foreground">{t('room.empty.description')}</p>
        </div>
      </Empty>
    )
  }

  const layout = getMeetStageLayout(sortedTiles.length)
  const canPinTiles = sortedTiles.length > 1
  const pinnedTile = pinnedTileId && canPinTiles
    ? (sortedTiles.find((tile) => tile.id === pinnedTileId) ?? null)
    : null
  const secondaryTiles = pinnedTile
    ? sortedTiles.filter((tile) => tile.id !== pinnedTile.id)
    : sortedTiles
  const gridStyle = {
    '--stage-cols': layout.columns,
    '--stage-rows': layout.rows
  } as CSSProperties

  return (
    <div className="grid h-full min-h-0 gap-3 [contain:layout_paint_style]">
      {pinnedTile ? (
        <div className="conference-stage-pinned h-full min-h-0 rounded-lg bg-surface shadow-xl [contain:layout_paint_style]">
          <div className="conference-stage-pinned-main">
            <div className="conference-stage-pinned-tile">
              <ParticipantTile
                canPin={canPinTiles}
                pinned
                speaking={speakingParticipantIds.includes(pinnedTile.participant.id)}
                t={t}
                tile={pinnedTile}
                onPin={onPin}
              />
            </div>
          </div>

          {secondaryTiles.length > 0 && (
            <ScrollArea className="conference-stage-pinned-strip">
              {secondaryTiles.map((tile) => (
                <ParticipantTile
                  canPin={canPinTiles}
                  key={tile.id}
                  pinned={false}
                  speaking={speakingParticipantIds.includes(tile.participant.id)}
                  t={t}
                  tile={tile}
                  onPin={onPin}
                />
              ))}
            </ScrollArea>
          )}
        </div>
      ) : (
        <ScrollArea
          className={cn(
            'conference-stage-viewport h-full min-h-0 rounded-lg bg-surface shadow-xl [contain:layout_paint_style]',
            layout.overflow ? 'overflow-auto' : 'overflow-hidden'
          )}
        >
          <div className="conference-stage-measure">
            <div
              className={cn(
                'conference-stage-grid [contain:layout_paint_style]',
                layout.overflow && 'conference-stage-grid-overflow'
              )}
              style={gridStyle}
            >
              {secondaryTiles.map((tile) => (
                <ParticipantTile
                  canPin={canPinTiles}
                  key={tile.id}
                  pinned={false}
                  speaking={speakingParticipantIds.includes(tile.participant.id)}
                  t={t}
                  tile={tile}
                  onPin={onPin}
                />
              ))}
            </div>
          </div>
        </ScrollArea>
      )}

      <div className="contents">
        {participants.map((participant) => {
          const mediaStreams =
            participant.id === localParticipantId
              ? localMediaStreams
              : (remoteMediaStreams[participant.id] ?? {})
          const audioStream = mediaStreams.audio ?? null
          const screenAudioStream = mediaStreams.screenAudio ?? null
          const audioOn = slotEnabled(participant, 'audio')
          const screenAudioOn = slotEnabled(participant, 'screenAudio')

          if (participant.id === localParticipantId) {
            return null
          }

          return (
            <Fragment key={`${participant.id}:audio-slots`}>
              {audioOn && audioStream && (
                <ParticipantAudio key={`${participant.id}:audio`} stream={audioStream} />
              )}
              {screenAudioOn && screenAudioStream && (
                <ParticipantAudio
                  key={`${participant.id}:screenAudio`}
                  stream={screenAudioStream}
                />
              )}
            </Fragment>
          )
        })}
      </div>
    </div>
  )
}, areConferenceStagePropsEqual)

type MeetStageLayout = {
  readonly columns: number
  readonly rows: number
  readonly overflow: boolean
}

function getMeetStageLayout(tileCount: number): MeetStageLayout {
  if (tileCount <= 1) return { columns: 1, rows: 1, overflow: false }
  if (tileCount === 2) return { columns: 2, rows: 1, overflow: false }
  if (tileCount <= 4) return { columns: 2, rows: 2, overflow: false }
  if (tileCount <= 6) return { columns: 3, rows: 2, overflow: false }
  if (tileCount <= 9) return { columns: 3, rows: 3, overflow: false }
  if (tileCount <= 12) return { columns: 4, rows: 3, overflow: false }

  return { columns: 4, rows: Math.ceil(tileCount / 4), overflow: true }
}

function areConferenceStagePropsEqual(
  previous: ConferenceStageProps,
  next: ConferenceStageProps
): boolean {
  return (
    previous.participants === next.participants &&
    previous.localParticipantId === next.localParticipantId &&
    previous.localSlotState === next.localSlotState &&
    previous.localMediaStreams === next.localMediaStreams &&
    previous.remoteMediaStreams === next.remoteMediaStreams &&
    previous.pinnedTileId === next.pinnedTileId &&
    previous.speakingParticipantIds === next.speakingParticipantIds &&
    previous.t === next.t &&
    previous.onPin === next.onPin
  )
}
