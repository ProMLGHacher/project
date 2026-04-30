import type { TFunction } from 'i18next'
import { Card, CardContent } from '@core/design-system'
import type { Participant } from '@features/room/domain/model/Participant'
import type { RoomPanel, RoomStatusMessageKey } from '../model/RoomState'
import type { ConferenceDiagnostics } from '../model/RoomDiagnostics'
import { CameraIcon, CameraOffIcon, CloseIcon, IconButton, MicIcon, MicOffIcon } from './room-icons'
import { slotEnabled } from './room-tile-model'
import { TechnicalPanel } from './TechnicalPanel'

type VoiceT = TFunction<'voice'>
type RoomPanelTitleKey =
  | 'room.panels.participants'
  | 'room.panels.roomInfo'
  | 'room.panels.techInfo'
  | 'room.panels.chat'

export interface RoomFloatingPanelProps {
  readonly roomId: string
  readonly status: string
  readonly participantCount: number
  readonly actionStatus: RoomStatusMessageKey
  readonly activePanel: RoomPanel | null
  readonly participants: readonly Participant[]
  readonly diagnostics: ConferenceDiagnostics | null
  readonly onClose: () => void
  readonly onExportLogs: () => void
  readonly onClearLogs: () => void
  readonly t: VoiceT
}

export function RoomFloatingPanel({
  roomId,
  status,
  participantCount,
  actionStatus,
  activePanel,
  participants,
  diagnostics,
  onClose,
  onExportLogs,
  onClearLogs,
  t
}: RoomFloatingPanelProps) {
  if (!activePanel) {
    return null
  }

  return (
    <div className="pointer-events-none fixed bottom-24 right-3 z-20 w-[calc(100vw-1.5rem)] max-w-sm sm:right-4 md:bottom-24">
      <Card className="pointer-events-auto animate-panel-in max-h-[min(34rem,calc(100dvh-7rem))] overflow-hidden rounded-lg border-border bg-surface text-foreground shadow-2xl">
        <CardContent className="grid max-h-[inherit] gap-4 overflow-y-auto p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-foreground">
                {t(panelTitle(activePanel))}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">{t(actionStatus)}</p>
            </div>
            <IconButton label={t('room.panels.close')} onClick={onClose}>
              <CloseIcon />
            </IconButton>
          </div>

          {activePanel === 'participants' && (
            <ParticipantsPanel participants={participants} t={t} />
          )}
          {activePanel === 'roomInfo' && (
            <RoomInfoPanel
              participantCount={participantCount}
              roomId={roomId}
              status={status}
              t={t}
            />
          )}
          {activePanel === 'techInfo' && (
            <TechnicalPanel
              diagnostics={diagnostics}
              onClearLogs={onClearLogs}
              onExportLogs={onExportLogs}
              t={t}
            />
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function panelTitle(panel: RoomPanel): RoomPanelTitleKey {
  switch (panel) {
    case 'participants':
      return 'room.panels.participants'
    case 'roomInfo':
      return 'room.panels.roomInfo'
    case 'techInfo':
      return 'room.panels.techInfo'
    case 'chat':
      return 'room.panels.chat'
  }
}

function ParticipantsPanel({
  participants,
  t
}: {
  readonly participants: readonly Participant[]
  readonly t: VoiceT
}) {
  return (
    <div className="grid gap-2">
      {participants.map((participant) => {
        const micOn = slotEnabled(participant, 'audio')
        const cameraOn = slotEnabled(participant, 'camera')

        return (
          <div
            key={participant.id}
            className="flex items-center gap-3 rounded-md bg-muted px-3 py-2"
          >
            <div className="grid size-9 shrink-0 place-items-center rounded-full bg-accent text-sm font-semibold text-accent-foreground">
              {participant.displayName.slice(0, 1).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{participant.displayName}</p>
              <p className="truncate text-xs text-muted-foreground">
                {t(`room.participant.roles.${participant.role}`)}
              </p>
            </div>
            <div className="flex items-center gap-1 text-muted-foreground">
              {micOn ? <MicIcon /> : <MicOffIcon />}
              {cameraOn ? <CameraIcon /> : <CameraOffIcon />}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function RoomInfoPanel({
  roomId,
  status,
  participantCount,
  t
}: {
  readonly roomId: string
  readonly status: string
  readonly participantCount: number
  readonly t: VoiceT
}) {
  return (
    <div className="grid gap-3">
      <InfoRow label={t('room.info.roomId')} value={roomId} />
      <InfoRow label={t('room.info.status')} value={status} />
      <InfoRow
        label={t('room.info.participants')}
        value={t('room.header.participants', { count: participantCount })}
      />
    </div>
  )
}

function InfoRow({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <div className="rounded-md bg-muted p-3">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 break-words text-sm font-semibold text-foreground">{value}</p>
    </div>
  )
}
