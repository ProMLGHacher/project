import { memo, useEffect, useRef, type ComponentProps, type ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router'
import { useSharedFlow, useStateFlow, useViewModel, type PropsWithVM } from '@kvt/react'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import {
  Alert,
  AlertDescription,
  Badge,
  Button,
  Card,
  CardContent,
  Empty,
  ScrollArea,
  cn,
  useToast
} from '@core/design-system'
import type { RtcMediaStreams } from '@capabilities/rtc/domain/model'
import type { Participant, ParticipantSlotKind } from '@features/room/domain/model/Participant'
import { PrejoinModal } from '@features/prejoin/presentation/view/PrejoinModal'
import { SettingsIcon, SettingsModal } from '@features/settings/presentation/view/SettingsModal'
import { useAttachMediaStream } from '@core/react/useAttachMediaStream'
import type { RoomPanel, RoomStatusMessageKey } from '../model/RoomState'
import { RoomViewModel } from '../view_model/RoomViewModel'

type VoiceT = TFunction<'voice'>
type RoomTileKind = 'presence' | 'camera' | 'screen'
type RoomPanelTitleKey =
  | 'room.panels.participants'
  | 'room.panels.roomInfo'
  | 'room.panels.techInfo'

type ParticipantMediaTile = {
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

export function RoomPage({ _vm = RoomViewModel }: PropsWithVM<RoomViewModel>): ReactNode {
  const { roomId = '' } = useParams()
  const navigate = useNavigate()
  const viewModel = useViewModel(_vm, { key: `room:${roomId}` })
  const uiState = useStateFlow(viewModel.uiState)
  const toasts = useToast()
  const { t } = useTranslation('voice')
  useEffect(() => {
    viewModel.onEvent({ type: 'room-opened', roomId })
  }, [roomId, viewModel])

  useSharedFlow(viewModel.uiEffect, (effect) => {
    switch (effect.type) {
      case 'navigate-home':
        void navigate('/')
        break
      case 'show-toast':
        toasts.toast(t(effect.message))
        break
      case 'download-logs':
        downloadTextFile(effect.fileName, effect.content)
        toasts.info(t('room.toasts.logsConsole'))
        break
    }
  })

  return (
    <section className="relative mx-auto flex min-h-screen w-full max-w-[100rem] flex-col px-2 py-2 sm:px-3 md:px-4">
      {uiState.error ? (
        <RoomErrorState
          actionLabel={t(uiState.error.actionLabel)}
          description={t(uiState.error.description)}
          title={t(uiState.error.title)}
          onAction={() => viewModel.onEvent({ type: 'go-home-pressed' })}
        />
      ) : (
        <>
          <div className="grid min-h-0 flex-1 pb-24">
            <ConferenceStage
              key={`stage:${roomId}`}
              localMediaStreams={uiState.localMediaStreams}
              localParticipantId={uiState.localParticipantId}
              participants={uiState.participants}
              pinnedTileId={uiState.pinnedTileId}
              remoteMediaStreams={uiState.remoteMediaStreams}
              speakingParticipantIds={uiState.speakingParticipantIds}
              t={t}
              onPin={(tileId) => viewModel.onEvent({ type: 'tile-pin-toggled', tileId })}
            />
          </div>

          <RoomFloatingPanel
            activePanel={uiState.activePanel}
            actionStatus={uiState.actionStatus}
            diagnostics={uiState.diagnostics}
            participantCount={uiState.participants.length}
            participants={uiState.participants}
            roomId={uiState.roomId}
            status={uiState.status}
            t={t}
            onClearLogs={() => viewModel.onEvent({ type: 'clear-logs-pressed' })}
            onClose={() => viewModel.onEvent({ type: 'panel-closed' })}
            onExportLogs={() => viewModel.onEvent({ type: 'export-logs-pressed' })}
          />

          <RoomBottomChrome
            activePanel={uiState.activePanel}
            cameraEnabled={uiState.camera.enabled}
            microphoneEnabled={uiState.microphone.enabled}
            roomId={uiState.roomId}
            screenEnabled={uiState.screenShare.enabled}
            onCamera={() => viewModel.onEvent({ type: 'camera-toggled' })}
            onCopy={() => viewModel.onEvent({ type: 'copy-link-pressed' })}
            onLeave={() => viewModel.onEvent({ type: 'leave-pressed' })}
            onMicrophone={() => viewModel.onEvent({ type: 'microphone-toggled' })}
            onPanelToggle={(panel) => viewModel.onEvent({ type: 'panel-toggled', panel })}
            onScreen={() => viewModel.onEvent({ type: 'screen-share-toggled' })}
            onSettings={() => viewModel.onEvent({ type: 'settings-opened' })}
            t={t}
          />
        </>
      )}

      <PrejoinModal
        open={uiState.prejoinOpen && Boolean(uiState.roomId)}
        roomId={uiState.roomId}
        role="host"
        onJoined={() => viewModel.onEvent({ type: 'prejoin-completed' })}
      />
      <SettingsModal
        open={uiState.settingsOpen}
        onClose={() => viewModel.onEvent({ type: 'settings-closed' })}
      />
    </section>
  )
}

function RoomBottomChrome({
  roomId,
  activePanel,
  microphoneEnabled,
  cameraEnabled,
  screenEnabled,
  onCopy,
  onSettings,
  onMicrophone,
  onCamera,
  onScreen,
  onLeave,
  onPanelToggle,
  t
}: {
  readonly roomId: string
  readonly activePanel: RoomPanel | null
  readonly microphoneEnabled: boolean
  readonly cameraEnabled: boolean
  readonly screenEnabled: boolean
  readonly onCopy: () => void
  readonly onSettings: () => void
  readonly onMicrophone: () => void
  readonly onCamera: () => void
  readonly onScreen: () => void
  readonly onLeave: () => void
  readonly onPanelToggle: (panel: RoomPanel) => void
  readonly t: VoiceT
}) {
  return (
    <div className="pointer-events-none sticky bottom-3 z-30 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] md:items-end">
      <div className="pointer-events-auto flex min-w-0 justify-center md:justify-start">
        <div className="flex max-w-full items-center gap-2 rounded-full border border-white/10 bg-slate-950/88 p-2 text-white shadow-2xl shadow-black/20 backdrop-blur-xl">
          <div className="min-w-0 px-3">
            <p className="truncate text-sm font-semibold">{roomId || t('room.header.untitled')}</p>
          </div>
          <IconButton label={t('room.header.copyLink')} onClick={onCopy}>
            <CopyIcon />
          </IconButton>
          <IconButton label={t('room.panels.settings')} onClick={onSettings}>
            <SettingsIcon />
          </IconButton>
        </div>
      </div>

      <div className="pointer-events-auto flex justify-center">
        <BottomDock
          cameraEnabled={cameraEnabled}
          microphoneEnabled={microphoneEnabled}
          screenEnabled={screenEnabled}
          onCamera={onCamera}
          onLeave={onLeave}
          onMicrophone={onMicrophone}
          onScreen={onScreen}
          t={t}
        />
      </div>

      <div className="pointer-events-auto flex justify-center md:justify-end">
        <div className="flex items-center gap-2 rounded-full border border-white/10 bg-slate-950/88 p-2 text-white shadow-2xl shadow-black/20 backdrop-blur-xl">
          <IconButton
            active={activePanel === 'participants'}
            label={t('room.panels.participants')}
            onClick={() => onPanelToggle('participants')}
          >
            <ParticipantsIcon />
          </IconButton>
          <IconButton
            active={activePanel === 'roomInfo'}
            label={t('room.panels.roomInfo')}
            onClick={() => onPanelToggle('roomInfo')}
          >
            <InfoIcon />
          </IconButton>
          <IconButton
            active={activePanel === 'techInfo'}
            label={t('room.panels.techInfo')}
            onClick={() => onPanelToggle('techInfo')}
          >
            <CodeIcon />
          </IconButton>
        </div>
      </div>
    </div>
  )
}

function RoomFloatingPanel({
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
}: {
  readonly roomId: string
  readonly status: string
  readonly participantCount: number
  readonly actionStatus: RoomStatusMessageKey
  readonly activePanel: RoomPanel | null
  readonly participants: readonly Participant[]
  readonly diagnostics: ComponentProps<typeof TechnicalPanel>['diagnostics']
  readonly onClose: () => void
  readonly onExportLogs: () => void
  readonly onClearLogs: () => void
  readonly t: VoiceT
}) {
  if (!activePanel) {
    return null
  }

  return (
    <div className="pointer-events-none fixed bottom-24 right-3 z-20 w-[calc(100vw-1.5rem)] max-w-sm sm:right-4 md:bottom-24">
      <Card className="pointer-events-auto animate-panel-in max-h-[min(34rem,calc(100dvh-7rem))] overflow-hidden rounded-[1.75rem] border-white/10 bg-slate-950/92 text-white shadow-2xl shadow-black/30 backdrop-blur-xl">
        <CardContent className="grid max-h-[inherit] gap-4 overflow-y-auto p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-white">{t(panelTitle(activePanel))}</h2>
              <p className="mt-1 text-sm text-slate-300">{t(actionStatus)}</p>
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
            className="flex items-center gap-3 rounded-2xl bg-white/8 px-3 py-2"
          >
            <div className="grid size-9 shrink-0 place-items-center rounded-full bg-white/12 text-sm font-semibold">
              {participant.displayName.slice(0, 1).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{participant.displayName}</p>
              <p className="truncate text-xs text-slate-400">
                {t(`room.participant.roles.${participant.role}`)}
              </p>
            </div>
            <div className="flex items-center gap-1 text-slate-300">
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
    <div className="rounded-2xl bg-white/8 p-3">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">{label}</p>
      <p className="mt-1 break-words text-sm font-semibold text-white">{value}</p>
    </div>
  )
}

function IconButton({
  active = false,
  children,
  label,
  onClick
}: {
  readonly active?: boolean
  readonly children: ReactNode
  readonly label: string
  readonly onClick: () => void
}) {
  return (
    <button
      aria-label={label}
      className={cn(
        'inline-flex size-10 items-center justify-center rounded-full text-white transition hover:scale-105',
        active ? 'bg-primary text-primary-foreground' : 'bg-white/10 hover:bg-white/18'
      )}
      onClick={onClick}
      title={label}
      type="button"
    >
      {children}
    </button>
  )
}

function ConferenceStage({
  participants,
  localParticipantId,
  localMediaStreams,
  remoteMediaStreams,
  pinnedTileId,
  speakingParticipantIds,
  onPin,
  t
}: {
  readonly participants: readonly Participant[]
  readonly localParticipantId: string | null
  readonly localMediaStreams: RtcMediaStreams
  readonly remoteMediaStreams: Readonly<Record<string, RtcMediaStreams>>
  readonly pinnedTileId: string | null
  readonly speakingParticipantIds: readonly string[]
  readonly onPin: (tileId: string) => void
  readonly t: VoiceT
}) {
  if (!participants.length) {
    return (
      <Empty className="min-h-[24rem] rounded-4xl bg-surface">
        <div>
          <p className="text-2xl font-medium text-foreground">{t('room.empty.title')}</p>
          <p className="mt-2 text-sm text-muted-foreground">{t('room.empty.description')}</p>
        </div>
      </Empty>
    )
  }

  const tiles = buildParticipantTiles(
    participants,
    localParticipantId,
    localMediaStreams,
    remoteMediaStreams
  )
  const sortedTiles = [...tiles].sort((left, right) => {
    if (left.id === pinnedTileId) return -1
    if (right.id === pinnedTileId) return 1
    if (left.kind === 'screen' && right.kind !== 'screen') return -1
    if (right.kind === 'screen' && left.kind !== 'screen') return 1
    if (left.local !== right.local) return left.local ? -1 : 1
    return left.participant.displayName.localeCompare(right.participant.displayName)
  })

  return (
    <div className="grid min-h-0 gap-3">
      <ScrollArea className="min-h-0 rounded-[2rem] bg-slate-950 p-2 shadow-xl shadow-black/10">
        <div className="grid auto-rows-fr gap-2 md:grid-cols-2 xl:grid-cols-3">
          {sortedTiles.map((tile) => (
            <ParticipantTile
              key={tile.id}
              pinned={tile.id === pinnedTileId}
              speaking={speakingParticipantIds.includes(tile.participant.id)}
              t={t}
              tile={tile}
              onPin={() => onPin(tile.id)}
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
          const audioOn = slotEnabled(participant, 'audio')

          if (!audioOn || !audioStream || participant.id === localParticipantId) {
            return null
          }

          return <ParticipantAudio key={`${participant.id}:audio`} stream={audioStream} />
        })}
      </div>
    </div>
  )
}

function ParticipantTile({
  tile,
  speaking,
  pinned,
  onPin,
  t
}: {
  readonly tile: ParticipantMediaTile
  readonly speaking: boolean
  readonly pinned: boolean
  readonly onPin: () => void
  readonly t: VoiceT
}) {
  const fullscreenRef = useRef<HTMLDivElement | null>(null)
  const title =
    tile.kind === 'screen'
      ? t('room.participant.screenFrom', { name: tile.participant.displayName })
      : tile.participant.displayName

  return (
    <Card
      className={cn(
        'overflow-hidden rounded-[1.75rem] bg-slate-950 text-white shadow-none transition-all duration-300',
        speaking ? 'border-primary/80 ring-2 ring-primary/45' : 'border-white/10',
        !tile.audioOn && 'border-destructive/45 ring-1 ring-destructive/20',
        pinned && 'md:col-span-2 xl:col-span-2'
      )}
    >
      <div
        ref={fullscreenRef}
        className={cn(
          'relative overflow-hidden bg-slate-950 transition-all duration-300',
          tile.kind === 'screen'
            ? pinned
              ? 'aspect-[16/9] min-h-[22rem]'
              : 'aspect-[16/10]'
            : pinned
              ? 'aspect-[16/9] min-h-[20rem]'
              : 'aspect-video',
          tile.kind === 'presence' && 'min-h-[15rem]'
        )}
      >
        {tile.stream ? (
          <ParticipantVideo
            muted={tile.local}
            objectFit={tile.kind === 'screen' ? 'contain' : 'cover'}
            stream={tile.stream}
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
              <div className="relative mx-auto grid size-20 place-items-center rounded-full bg-white/12 text-3xl font-semibold shadow-2xl shadow-black/25 ring-1 ring-white/15 transition-transform duration-300 sm:size-24 sm:text-4xl">
                <span className={cn('inline-block transition-transform', speaking && 'scale-105')}>
                  {tile.participant.displayName.slice(0, 1).toUpperCase()}
                </span>
              </div>
              {tile.awaitingMedia && (
                <p className="mt-4 max-w-64 text-sm leading-6 text-slate-300">
                  {t('room.participant.waitingMedia')}
                </p>
              )}
            </div>
          </div>
        )}

        {!tile.audioOn && (
          <div className="pointer-events-none absolute inset-0 bg-destructive/10" />
        )}
        <div className="absolute inset-x-0 bottom-0 h-28 bg-linear-to-t from-slate-950/90 to-transparent" />
        <div className="absolute left-3 right-3 top-3 flex items-start justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            {tile.local && <Badge variant="info">{t('room.participant.you')}</Badge>}
            {tile.kind === 'screen' && (
              <Badge variant="warning">{t('room.participant.screen')}</Badge>
            )}
            {pinned && <Badge variant="success">{t('room.participant.pinned')}</Badge>}
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <button
              className="rounded-full bg-black/35 px-3 py-1.5 text-xs font-medium text-white backdrop-blur transition hover:bg-black/50"
              onClick={onPin}
              type="button"
            >
              {pinned ? t('room.participant.unpin') : t('room.participant.pin')}
            </button>
            {tile.kind === 'screen' && (
              <button
                className="rounded-full bg-black/35 px-3 py-1.5 text-xs font-medium text-white backdrop-blur transition hover:bg-black/50"
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

        <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-base font-medium">{title}</p>
            <p className="truncate text-xs text-slate-300">
              {t(`room.participant.roles.${tile.participant.role}`)}
            </p>
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
}

const ParticipantVideo = memo(function ParticipantVideo({
  stream,
  muted,
  objectFit
}: {
  readonly stream: MediaStream
  readonly muted: boolean
  readonly objectFit: 'cover' | 'contain'
}) {
  const ref = useRef<HTMLVideoElement | null>(null)
  useAttachMediaStream(ref, stream)

  return (
    <video
      autoPlay
      className={cn(
        'h-full w-full bg-slate-950',
        objectFit === 'contain' ? 'object-contain' : 'object-cover'
      )}
      muted={muted}
      playsInline
      ref={ref}
    />
  )
})

const ParticipantAudio = memo(function ParticipantAudio({
  stream
}: {
  readonly stream: MediaStream
}) {
  const ref = useRef<HTMLAudioElement | null>(null)
  useAttachMediaStream(ref, stream)

  return <audio autoPlay ref={ref} />
})

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
        'inline-flex size-8 items-center justify-center rounded-full backdrop-blur',
        enabled ? 'bg-white/14 text-white' : 'bg-destructive/85 text-on-feedback'
      )}
      title={label}
    >
      {children}
    </span>
  )
}

function BottomDock({
  microphoneEnabled,
  cameraEnabled,
  screenEnabled,
  onMicrophone,
  onCamera,
  onScreen,
  onLeave,
  t
}: {
  readonly microphoneEnabled: boolean
  readonly cameraEnabled: boolean
  readonly screenEnabled: boolean
  readonly onMicrophone: () => void
  readonly onCamera: () => void
  readonly onScreen: () => void
  readonly onLeave: () => void
  readonly t: VoiceT
}) {
  return (
    <Card className="animate-panel-in rounded-full border-white/10 bg-slate-950/90 text-white shadow-2xl shadow-black/20 backdrop-blur-xl">
      <CardContent className="flex items-center justify-center gap-2 p-2">
        <DockButton
          active={microphoneEnabled}
          activeIcon={<MicIcon />}
          inactiveIcon={<MicOffIcon />}
          label={microphoneEnabled ? t('room.controls.mute') : t('room.controls.unmute')}
          onClick={onMicrophone}
        />
        <DockButton
          active={cameraEnabled}
          activeIcon={<CameraIcon />}
          inactiveIcon={<CameraOffIcon />}
          label={cameraEnabled ? t('room.controls.cameraOff') : t('room.controls.cameraOn')}
          onClick={onCamera}
        />
        <DockButton
          active={screenEnabled}
          activeIcon={<ScreenIcon />}
          inactiveIcon={<ScreenIcon />}
          label={screenEnabled ? t('room.controls.stopShare') : t('room.controls.shareScreen')}
          onClick={onScreen}
          variant={screenEnabled ? 'activeShare' : 'neutral'}
        />
        <DockButton
          active
          activeIcon={<LeaveIcon />}
          inactiveIcon={<LeaveIcon />}
          label={t('room.header.leave')}
          onClick={onLeave}
          variant="danger"
        />
      </CardContent>
    </Card>
  )
}

function DockButton({
  active,
  activeIcon,
  inactiveIcon,
  label,
  onClick,
  variant = 'media'
}: {
  readonly active: boolean
  readonly activeIcon: ReactNode
  readonly inactiveIcon: ReactNode
  readonly label: string
  readonly onClick: () => void
  readonly variant?: 'media' | 'neutral' | 'activeShare' | 'danger'
}) {
  return (
    <button
      aria-label={label}
      className={cn(
        'inline-flex size-12 items-center justify-center rounded-full text-white transition duration-200 hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:size-13',
        variant === 'danger' || (!active && variant === 'media')
          ? 'bg-destructive text-on-feedback shadow-lg shadow-destructive/25 hover:opacity-95'
          : variant === 'activeShare'
            ? 'bg-info text-on-feedback shadow-lg shadow-info/25'
            : 'bg-white/12 hover:bg-white/18'
      )}
      onClick={onClick}
      title={label}
      type="button"
    >
      {active ? activeIcon : inactiveIcon}
    </button>
  )
}

function MicIcon() {
  return (
    <svg aria-hidden="true" className="size-5" fill="none" viewBox="0 0 24 24">
      <path
        d="M12 14.5a3.5 3.5 0 0 0 3.5-3.5V7a3.5 3.5 0 0 0-7 0v4a3.5 3.5 0 0 0 3.5 3.5ZM5 11a7 7 0 0 0 14 0M12 18v3M9 21h6"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.8"
      />
    </svg>
  )
}

function MicOffIcon() {
  return (
    <svg aria-hidden="true" className="size-5" fill="none" viewBox="0 0 24 24">
      <path
        d="m4 4 16 16M9.3 5.1A3.5 3.5 0 0 1 15.5 7v4c0 .55-.13 1.06-.35 1.52M8.5 8.9V11a3.5 3.5 0 0 0 5.15 3.09M5 11a7 7 0 0 0 10.4 6.1M19 11a6.95 6.95 0 0 1-1.1 3.76M12 18v3M9 21h6"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.8"
      />
    </svg>
  )
}

function CameraIcon() {
  return (
    <svg aria-hidden="true" className="size-5" fill="none" viewBox="0 0 24 24">
      <path
        d="M4.5 8.5A2.5 2.5 0 0 1 7 6h7a2.5 2.5 0 0 1 2.5 2.5v7A2.5 2.5 0 0 1 14 18H7a2.5 2.5 0 0 1-2.5-2.5v-7ZM16.5 10.2l3.6-2.1v7.8l-3.6-2.1"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  )
}

function CameraOffIcon() {
  return (
    <svg aria-hidden="true" className="size-5" fill="none" viewBox="0 0 24 24">
      <path
        d="m4 4 16 16M5.8 6.55A2.5 2.5 0 0 0 4.5 8.75v6.75A2.5 2.5 0 0 0 7 18h7a2.5 2.5 0 0 0 1.9-.87M9.2 6H14a2.5 2.5 0 0 1 2.5 2.5v5.3M16.5 10.2l3.6-2.1v7.8l-3.6-2.1"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  )
}

function ScreenIcon() {
  return (
    <svg aria-hidden="true" className="size-5" fill="none" viewBox="0 0 24 24">
      <path
        d="M5 6.5h14A2.5 2.5 0 0 1 21.5 9v7A2.5 2.5 0 0 1 19 18.5H5A2.5 2.5 0 0 1 2.5 16V9A2.5 2.5 0 0 1 5 6.5ZM9 21h6M12 18.5V21M12 15V10M9.5 12.5 12 10l2.5 2.5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  )
}

function LeaveIcon() {
  return (
    <svg aria-hidden="true" className="size-5" fill="none" viewBox="0 0 24 24">
      <path
        d="M14 7V5.5A2.5 2.5 0 0 0 11.5 3h-5A2.5 2.5 0 0 0 4 5.5v13A2.5 2.5 0 0 0 6.5 21h5A2.5 2.5 0 0 0 14 18.5V17M10 12h10M17 8.5 20.5 12 17 15.5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  )
}

function CopyIcon() {
  return (
    <svg aria-hidden="true" className="size-5" fill="none" viewBox="0 0 24 24">
      <path
        d="M8 8.5A2.5 2.5 0 0 1 10.5 6h6A2.5 2.5 0 0 1 19 8.5v9A2.5 2.5 0 0 1 16.5 20h-6A2.5 2.5 0 0 1 8 17.5v-9Z"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="M5 15.5v-9A2.5 2.5 0 0 1 7.5 4h6"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.8"
      />
    </svg>
  )
}

function ParticipantsIcon() {
  return (
    <svg aria-hidden="true" className="size-5" fill="none" viewBox="0 0 24 24">
      <path
        d="M9.5 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM3.5 20a6 6 0 0 1 12 0M16 11.5a3 3 0 1 0 0-6M18 19.5a5 5 0 0 0-2.5-4.33"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.8"
      />
    </svg>
  )
}

function InfoIcon() {
  return (
    <svg aria-hidden="true" className="size-5" fill="none" viewBox="0 0 24 24">
      <path
        d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 11v5M12 8h.01"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.8"
      />
    </svg>
  )
}

function CodeIcon() {
  return (
    <svg aria-hidden="true" className="size-5" fill="none" viewBox="0 0 24 24">
      <path
        d="m8 9-3 3 3 3M16 9l3 3-3 3M14 5l-4 14"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  )
}

function CloseIcon() {
  return (
    <svg aria-hidden="true" className="size-5" fill="none" viewBox="0 0 24 24">
      <path
        d="m7 7 10 10M17 7 7 17"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.8"
      />
    </svg>
  )
}

function TechnicalPanel({
  className,
  diagnostics,
  onExportLogs,
  onClearLogs,
  t
}: {
  readonly className?: string
  readonly diagnostics: {
    readonly room: readonly string[]
    readonly publisher: readonly string[]
    readonly subscriber: readonly string[]
    readonly signaling: readonly string[]
  } | null
  readonly onExportLogs: () => void
  readonly onClearLogs: () => void
  readonly t: VoiceT
}) {
  return (
    <div className={cn('min-h-0 rounded-[1.75rem]', className)}>
      <div className="grid h-full gap-4">
        <div>
          <h3 className="text-base font-semibold text-white">{t('room.tech.title')}</h3>
        </div>

        {diagnostics ? (
          <div className="grid gap-3">
            <DiagnosticGroup title={t('room.tech.room')} values={diagnostics.room} />
            <DiagnosticGroup title={t('room.tech.publisher')} values={diagnostics.publisher} />
            <DiagnosticGroup title={t('room.tech.subscriber')} values={diagnostics.subscriber} />
            <DiagnosticGroup title={t('room.tech.signaling')} values={diagnostics.signaling} />
          </div>
        ) : (
          <Alert>
            <AlertDescription>{t('room.tech.noDiagnostics')}</AlertDescription>
          </Alert>
        )}

        <div className="mt-auto grid gap-2 sm:grid-cols-2">
          <Button className="rounded-full" onClick={onExportLogs} type="button" variant="outline">
            {t('room.tech.export')}
          </Button>
          <Button className="rounded-full" onClick={onClearLogs} type="button" variant="ghost">
            {t('room.tech.clear')}
          </Button>
        </div>
      </div>
    </div>
  )
}

function DiagnosticGroup({
  title,
  values
}: {
  readonly title: string
  readonly values: readonly string[]
}) {
  return (
    <div className="rounded-2xl bg-white/8 p-3">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{title}</p>
      <ul className="mt-2 grid gap-1 text-xs text-slate-300">
        {values.map((value) => (
          <li key={value}>{value}</li>
        ))}
      </ul>
    </div>
  )
}

function RoomErrorState({
  title,
  description,
  actionLabel,
  onAction
}: {
  readonly title: string
  readonly description: string
  readonly actionLabel: string
  readonly onAction: () => void
}) {
  return (
    <Card className="grid min-h-[28rem] place-items-center rounded-4xl">
      <CardContent className="max-w-xl p-6 text-center sm:p-8">
        <div className="mx-auto grid size-16 place-items-center rounded-full bg-muted text-2xl font-medium text-muted-foreground">
          !
        </div>
        <h2 className="mt-5 text-2xl font-medium text-foreground sm:text-3xl">{title}</h2>
        <p className="mt-3 text-sm leading-6 text-muted-foreground sm:text-base">{description}</p>
        <Button className="mt-6 rounded-full px-6" onClick={onAction} type="button">
          {actionLabel}
        </Button>
      </CardContent>
    </Card>
  )
}

function buildParticipantTiles(
  participants: readonly Participant[],
  localParticipantId: string | null,
  localMediaStreams: RtcMediaStreams,
  remoteMediaStreams: Readonly<Record<string, RtcMediaStreams>>
): ParticipantMediaTile[] {
  const tiles: ParticipantMediaTile[] = []

  for (const participant of participants) {
    const local = participant.id === localParticipantId
    const mediaStreams = local ? localMediaStreams : (remoteMediaStreams[participant.id] ?? {})
    const audioOn = slotEnabled(participant, 'audio')
    const cameraOn = slotEnabled(participant, 'camera')
    const screenOn = slotEnabled(participant, 'screen')
    const cameraStream = mediaStreams.camera ?? null
    const screenStream = mediaStreams.screen ?? null

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

    if (!cameraOn && !screenOn && !cameraStream && !screenStream) {
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
  }

  return tiles
}

function slotEnabled(participant: Participant, kind: ParticipantSlotKind): boolean {
  return participant.slots.some((slot) => slot.kind === kind && slot.enabled && slot.publishing)
}

function downloadTextFile(fileName: string, content: string) {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.append(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
