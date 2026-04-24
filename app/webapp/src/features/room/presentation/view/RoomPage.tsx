import { memo, useEffect, useRef, type ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router'
import { useSharedFlow, useStateFlow, useViewModel, type PropsWithVM } from '@kvt/react'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import {
  Alert,
  AlertDescription,
  Badge,
  Button,
  ButtonGroup,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Empty,
  ScrollArea,
  Switch,
  Toggle,
  cn,
  useToast
} from '@core/design-system'
import type { Participant, ParticipantSlotKind } from '@features/room/domain/model/Participant'
import { PrejoinModal } from '@features/prejoin/presentation/view/PrejoinModal'
import { RoomViewModel } from '../view_model/RoomViewModel'
import type { RoomStatusMessageKey } from '../model/RoomState'
import { useAttachMediaStream } from '@core/react/useAttachMediaStream'

type VoiceT = TFunction<'voice'>

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
    <section className="mx-auto flex min-h-full w-full max-w-7xl flex-col gap-3 px-3 pb-4 sm:gap-4 sm:px-4 md:px-6">
      <RoomHeader
        actionStatus={uiState.actionStatus}
        participantCount={uiState.participants.length}
        roomId={uiState.roomId}
        status={uiState.status}
        technicalInfoVisible={uiState.technicalInfoVisible}
        onCopy={() => viewModel.onEvent({ type: 'copy-link-pressed' })}
        onLeave={() => viewModel.onEvent({ type: 'leave-pressed' })}
        onTechnicalInfoChange={(visible) =>
          viewModel.onEvent({ type: 'technical-info-toggled', visible })
        }
      />

      {uiState.error ? (
        <RoomErrorState
          actionLabel={t(uiState.error.actionLabel)}
          description={t(uiState.error.description)}
          title={t(uiState.error.title)}
          onAction={() => viewModel.onEvent({ type: 'go-home-pressed' })}
        />
      ) : (
        <div
          className={cn(
            'grid min-h-0 flex-1 gap-3 sm:gap-4',
            uiState.technicalInfoVisible ? 'xl:grid-cols-4' : 'grid-cols-1'
          )}
        >
          <main
            className={cn(
              'grid min-h-0 gap-3 sm:gap-4',
              uiState.technicalInfoVisible && 'xl:col-span-3'
            )}
          >
            <ParticipantGrid
              localParticipantId={uiState.localParticipantId}
              localStream={uiState.localStream}
              participants={uiState.participants}
              remoteStreams={uiState.remoteStreams}
              t={t}
            />
            <ControlBar
              cameraEnabled={uiState.camera.enabled}
              microphoneEnabled={uiState.microphone.enabled}
              screenEnabled={uiState.screenShare.enabled}
              onCamera={() => viewModel.onEvent({ type: 'camera-toggled' })}
              onMicrophone={() => viewModel.onEvent({ type: 'microphone-toggled' })}
              onScreen={() => viewModel.onEvent({ type: 'screen-share-toggled' })}
              t={t}
            />
          </main>

          {uiState.technicalInfoVisible && (
            <TechnicalPanel
              diagnostics={uiState.diagnostics}
              onClearLogs={() => viewModel.onEvent({ type: 'clear-logs-pressed' })}
              onExportLogs={() => viewModel.onEvent({ type: 'export-logs-pressed' })}
              t={t}
            />
          )}
        </div>
      )}

      <PrejoinModal
        open={uiState.prejoinOpen && Boolean(uiState.roomId)}
        roomId={uiState.roomId}
        role="host"
        onJoined={() => viewModel.onEvent({ type: 'prejoin-completed' })}
      />
    </section>
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
    <Card className="grid min-h-96 place-items-center rounded-4xl">
      <CardContent className="max-w-xl p-6 text-center sm:p-8">
        <div className="mx-auto grid size-16 place-items-center rounded-full bg-muted text-2xl font-black text-muted-foreground">
          !
        </div>
        <h2 className="mt-5 font-display text-2xl font-black tracking-tight text-surface-foreground sm:text-3xl">
          {title}
        </h2>
        <p className="mt-3 text-sm leading-6 text-muted-foreground sm:text-base">{description}</p>
        <Button className="mt-6 rounded-2xl" onClick={onAction} type="button">
          {actionLabel}
        </Button>
      </CardContent>
    </Card>
  )
}

interface RoomHeaderProps {
  readonly roomId: string
  readonly status: string
  readonly participantCount: number
  readonly actionStatus: RoomStatusMessageKey
  readonly technicalInfoVisible: boolean
  readonly onCopy: () => void
  readonly onLeave: () => void
  readonly onTechnicalInfoChange: (visible: boolean) => void
}

function RoomHeader({
  roomId,
  status,
  participantCount,
  actionStatus,
  technicalInfoVisible,
  onCopy,
  onLeave,
  onTechnicalInfoChange
}: RoomHeaderProps) {
  const { t } = useTranslation('voice')

  return (
    <Card className="rounded-4xl">
      <CardContent className="flex flex-col gap-4 p-3 sm:p-4 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={status === 'connected' ? 'success' : 'default'}>{status}</Badge>
            <Badge>{t('room.header.participants', { count: participantCount })}</Badge>
          </div>
          <h1 className="mt-2 break-words font-display text-xl font-black tracking-tight sm:text-2xl md:text-3xl">
            {t('room.header.title', { roomId })}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{t(actionStatus)}</p>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
          <label className="col-span-2 flex items-center justify-center gap-2 rounded-full border border-border bg-muted px-3 py-2 text-sm sm:col-span-1">
            <Switch checked={technicalInfoVisible} onCheckedChange={onTechnicalInfoChange} />
            {t('room.header.techInfo')}
          </label>
          <Button className="w-full sm:w-auto" onClick={onCopy} type="button" variant="outline">
            {t('room.header.copyLink')}
          </Button>
          <Button
            className="w-full sm:w-auto"
            onClick={onLeave}
            type="button"
            variant="destructive"
          >
            {t('room.header.leave')}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

interface ParticipantGridProps {
  readonly participants: readonly Participant[]
  readonly localParticipantId: string | null
  readonly localStream: MediaStream | null
  readonly remoteStreams: Readonly<Record<string, MediaStream>>
  readonly t: VoiceT
}

function ParticipantGrid({
  participants,
  localParticipantId,
  localStream,
  remoteStreams,
  t
}: ParticipantGridProps) {
  if (!participants.length) {
    return (
      <Empty className="min-h-0 flex-1">
        <div>
          <p className="font-display text-2xl font-black text-foreground">
            {t('room.empty.title')}
          </p>
          <p className="mt-2 text-sm">{t('room.empty.description')}</p>
        </div>
      </Empty>
    )
  }

  return (
    <ScrollArea className="min-h-0 rounded-4xl">
      <div className="grid auto-rows-fr gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-3">
        {participants.map((participant) => (
          <ParticipantTile
            key={participant.id}
            local={participant.id === localParticipantId}
            participant={participant}
            stream={
              participant.id === localParticipantId ? localStream : remoteStreams[participant.id]
            }
            t={t}
          />
        ))}
      </div>
    </ScrollArea>
  )
}

function ParticipantTile({
  participant,
  local,
  stream,
  t
}: {
  readonly participant: Participant
  readonly local: boolean
  readonly stream: MediaStream | null | undefined
  readonly t: VoiceT
}) {
  const cameraOn = slotEnabled(participant, 'camera')
  const screenOn = slotEnabled(participant, 'screen')
  const audioOn = slotEnabled(participant, 'audio')
  const showVideo = Boolean(stream) && (cameraOn || screenOn)
  const awaitingMedia = !stream && (audioOn || cameraOn || screenOn)

  return (
    <Card className="group overflow-hidden rounded-4xl">
      <div className="relative grid aspect-video place-items-center overflow-hidden bg-slate-950 text-white">
        {showVideo && stream ? (
          <ParticipantVideo muted={local} stream={stream} />
        ) : (
          <div className="grid gap-3 p-6 text-center">
            <div className="mx-auto grid size-20 place-items-center rounded-full bg-white/10 text-3xl font-black">
              {participant.displayName.slice(0, 1).toUpperCase()}
            </div>
            {awaitingMedia && (
              <p className="max-w-56 text-xs leading-5 text-slate-300">
                {t('room.participant.waitingMedia')}
              </p>
            )}
          </div>
        )}
        <div className="absolute left-3 top-3 flex gap-2">
          {local && <Badge variant="info">{t('room.participant.you')}</Badge>}
          {screenOn && <Badge variant="warning">{t('room.participant.screen')}</Badge>}
        </div>
        {audioOn && stream && !local && <ParticipantAudio stream={stream} />}
      </div>
      <CardContent className="flex items-center justify-between gap-3 p-3 sm:p-4">
        <div className="min-w-0">
          <p className="truncate font-bold">{participant.displayName}</p>
          <p className="text-xs text-muted-foreground">
            {t(`room.participant.roles.${participant.role}`)}
          </p>
        </div>
        <div className="flex shrink-0 gap-1">
          <SlotBadge enabled={audioOn} label={t('room.participant.mic')} />
          <SlotBadge enabled={cameraOn} label={t('room.participant.cam')} />
        </div>
      </CardContent>
    </Card>
  )
}

const ParticipantVideo = memo(function ParticipantVideo({
  stream,
  muted
}: {
  readonly stream: MediaStream
  readonly muted: boolean
}) {
  const ref = useRef<HTMLVideoElement | null>(null)
  useAttachMediaStream(ref, stream)

  return (
    <video autoPlay className="h-full w-full object-cover" muted={muted} playsInline ref={ref} />
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

function SlotBadge({ enabled, label }: { readonly enabled: boolean; readonly label: string }) {
  return <Badge variant={enabled ? 'success' : 'default'}>{label}</Badge>
}

interface ControlBarProps {
  readonly microphoneEnabled: boolean
  readonly cameraEnabled: boolean
  readonly screenEnabled: boolean
  readonly onMicrophone: () => void
  readonly onCamera: () => void
  readonly onScreen: () => void
  readonly t: VoiceT
}

function ControlBar({
  microphoneEnabled,
  cameraEnabled,
  screenEnabled,
  onMicrophone,
  onCamera,
  onScreen,
  t
}: ControlBarProps) {
  return (
    <Card className="sticky bottom-3 z-20 rounded-4xl sm:static">
      <CardContent className="p-2 sm:p-4">
        <ButtonGroup className="grid w-full grid-cols-1 gap-1 sm:inline-flex sm:w-auto">
          <Toggle className="w-full px-2" aria-pressed={microphoneEnabled} onClick={onMicrophone}>
            {microphoneEnabled ? t('room.controls.mute') : t('room.controls.unmute')}
          </Toggle>
          <Toggle className="w-full px-2" aria-pressed={cameraEnabled} onClick={onCamera}>
            {cameraEnabled ? t('room.controls.cameraOff') : t('room.controls.cameraOn')}
          </Toggle>
          <Toggle className="w-full px-2" aria-pressed={screenEnabled} onClick={onScreen}>
            {screenEnabled ? t('room.controls.stopShare') : t('room.controls.shareScreen')}
          </Toggle>
        </ButtonGroup>
      </CardContent>
    </Card>
  )
}

function TechnicalPanel({
  diagnostics,
  onExportLogs,
  onClearLogs,
  t
}: {
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
    <Card className="min-h-0 rounded-4xl">
      <CardHeader className="p-4 sm:p-5">
        <CardTitle>{t('room.tech.title')}</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3 p-3 sm:gap-4 sm:p-5">
        {diagnostics ? (
          <>
            <DiagnosticGroup title={t('room.tech.room')} values={diagnostics.room} />
            <DiagnosticGroup title={t('room.tech.publisher')} values={diagnostics.publisher} />
            <DiagnosticGroup title={t('room.tech.subscriber')} values={diagnostics.subscriber} />
            <DiagnosticGroup title={t('room.tech.signaling')} values={diagnostics.signaling} />
          </>
        ) : (
          <Alert>
            <AlertDescription>{t('room.tech.noDiagnostics')}</AlertDescription>
          </Alert>
        )}
        <div className="grid gap-2 sm:grid-cols-2">
          <Button onClick={onExportLogs} type="button" variant="outline">
            {t('room.tech.export')}
          </Button>
          <Button onClick={onClearLogs} type="button" variant="ghost">
            {t('room.tech.clear')}
          </Button>
        </div>
      </CardContent>
    </Card>
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
    <div className="rounded-xl border border-border bg-muted/40 p-3">
      <p className="text-xs font-black uppercase tracking-wide text-muted-foreground">{title}</p>
      <ul className="mt-2 grid gap-1 text-xs text-muted-foreground">
        {values.map((value) => (
          <li key={value}>{value}</li>
        ))}
      </ul>
    </div>
  )
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
