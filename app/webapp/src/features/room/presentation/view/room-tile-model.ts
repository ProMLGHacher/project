import type { RtcMediaStreams } from '@capabilities/rtc/domain/model'
import type { Participant, ParticipantSlotKind } from '@features/room/domain/model/Participant'

export type RoomTileKind = 'presence' | 'camera' | 'screen'

export type ParticipantMediaTile = {
  readonly id: string
  readonly participant: Participant
  readonly kind: RoomTileKind
  readonly stream: MediaStream | null
  readonly local: boolean
  readonly audioOn: boolean
  readonly cameraOn: boolean
  readonly screenOn: boolean
  readonly awaitingMedia: boolean
}

export type LocalParticipantSlotState = {
  readonly audio: boolean
  readonly camera: boolean
  readonly screen: boolean
}

export function buildParticipantTiles(
  participants: readonly Participant[],
  localParticipantId: string | null,
  localMediaStreams: RtcMediaStreams,
  remoteMediaStreams: Readonly<Record<string, RtcMediaStreams>>,
  localSlotState: LocalParticipantSlotState
): ParticipantMediaTile[] {
  const tiles: ParticipantMediaTile[] = []

  for (const participant of participants) {
    const local = participant.id === localParticipantId
    const mediaStreams = local ? localMediaStreams : (remoteMediaStreams[participant.id] ?? {})
    const cameraStream = mediaStreams.camera ?? null
    const screenStream = mediaStreams.screen ?? null
    const audioOn = local
      ? localSlotState.audio || Boolean(mediaStreams.audio)
      : slotEnabled(participant, 'audio')
    const cameraOn = local
      ? localSlotState.camera || Boolean(cameraStream)
      : slotEnabled(participant, 'camera')
    const screenOn = local
      ? localSlotState.screen || Boolean(screenStream)
      : slotEnabled(participant, 'screen')

    if (cameraOn || cameraStream) {
      tiles.push({
        id: `${participant.id}:camera`,
        participant,
        kind: 'camera',
        stream: cameraStream,
        local,
        audioOn,
        cameraOn,
        screenOn,
        awaitingMedia: cameraOn && !cameraStream
      })
    } else {
      tiles.push({
        id: `${participant.id}:presence`,
        participant,
        kind: 'presence',
        stream: null,
        local,
        audioOn,
        cameraOn,
        screenOn,
        awaitingMedia: audioOn
      })
    }

    if (screenOn || screenStream) {
      tiles.push({
        id: `${participant.id}:screen`,
        participant,
        kind: 'screen',
        stream: screenStream,
        local,
        audioOn,
        cameraOn,
        screenOn,
        awaitingMedia: screenOn && !screenStream
      })
    }
  }

  return tiles
}

export function slotEnabled(participant: Participant, kind: ParticipantSlotKind): boolean {
  return participant.slots.some(
    (slot) => slot.kind === kind && slot.enabled && slot.publishing && slot.trackBound
  )
}
