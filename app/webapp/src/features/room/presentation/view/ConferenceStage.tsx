import { Fragment, memo, useMemo } from 'react'
import type { TFunction } from 'i18next'
import { Empty, ScrollArea } from '@core/design-system'
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

  return (
    <div className="grid min-h-0 gap-3 [contain:layout_paint_style]">
      <ScrollArea className="min-h-0 rounded-lg bg-surface p-2 shadow-xl [contain:layout_paint_style]">
        <div className="grid auto-rows-fr gap-2 [contain:layout_paint_style] md:grid-cols-2 xl:grid-cols-3">
          {sortedTiles.map((tile) => (
            <ParticipantTile
              key={tile.id}
              pinned={tile.id === pinnedTileId}
              speaking={speakingParticipantIds.includes(tile.participant.id)}
              t={t}
              tile={tile}
              onPin={onPin}
            />
          ))}
        </div>
      </ScrollArea>

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
