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
  Card,
  CardContent,
  Empty,
  ScrollArea,
  Switch,
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
    <section className="mx-auto flex min-h-[calc(100vh-4.5rem)] w-full max-w-7xl flex-col gap-3 px-3 py-3 sm:px-4 md:px-6">
      <RoomTopBar
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
        <>
          <div
            className={cn(
              'grid min-h-0 flex-1 gap-3',
              uiState.technicalInfoVisible ? 'xl:grid-cols-[minmax(0,1fr)_22rem]' : 'grid-cols-1'
            )}
          >
            <ConferenceStage
              localParticipantId={uiState.localParticipantId}
              localStream={uiState.localStream}
              participants={uiState.participants}
              remoteStreams={uiState.remoteStreams}
              t={t}
            />

            {uiState.technicalInfoVisible && (
              <TechnicalPanel
                diagnostics={uiState.diagnostics}
                onClearLogs={() => viewModel.onEvent({ type: 'clear-logs-pressed' })}
                onExportLogs={() => viewModel.onEvent({ type: 'export-logs-pressed' })}
                t={t}
              />
            )}
          </div>

          <BottomDock
            cameraEnabled={uiState.camera.enabled}
            microphoneEnabled={uiState.microphone.enabled}
            screenEnabled={uiState.screenShare.enabled}
            onCamera={() => viewModel.onEvent({ type: 'camera-toggled' })}
            onMicrophone={() => viewModel.onEvent({ type: 'microphone-toggled' })}
            onScreen={() => viewModel.onEvent({ type: 'screen-share-toggled' })}
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
    </section>
  )
}

function RoomTopBar({
  roomId,
  status,
  participantCount,
  actionStatus,
  technicalInfoVisible,
  onCopy,
  onLeave,
  onTechnicalInfoChange
}: {
  readonly roomId: string
  readonly status: string
  readonly participantCount: number
  readonly actionStatus: RoomStatusMessageKey
  readonly technicalInfoVisible: boolean
  readonly onCopy: () => void
  readonly onLeave: () => void
  readonly onTechnicalInfoChange: (visible: boolean) => void
}) {
  const { t } = useTranslation('voice')

  return (
    <Card className="rounded-4xl border-border/80 bg-surface">
      <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={status === 'connected' ? 'success' : 'default'}>{status}</Badge>
            <Badge>{t('room.header.participants', { count: participantCount })}</Badge>
          </div>
          <h1 className="mt-3 truncate text-xl font-medium text-foreground sm:text-2xl">
            {t('room.header.title', { roomId })}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{t(actionStatus)}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-3 rounded-full border border-border bg-background px-4 py-2 text-sm text-foreground">
            <Switch checked={technicalInfoVisible} onCheckedChange={onTechnicalInfoChange} />
            {t('room.header.techInfo')}
          </label>
          <Button className="rounded-full px-5" onClick={onCopy} type="button" variant="outline">
            {t('room.header.copyLink')}
          </Button>
          <Button
            className="rounded-full px-5"
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

function ConferenceStage({
  participants,
  localParticipantId,
  localStream,
  remoteStreams,
  t
}: {
  readonly participants: readonly Participant[]
  readonly localParticipantId: string | null
  readonly localStream: MediaStream | null
  readonly remoteStreams: Readonly<Record<string, MediaStream>>
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

  return (
    <ScrollArea className="min-h-0 rounded-4xl">
      <div className="grid min-h-full auto-rows-fr gap-3 sm:grid-cols-2 xl:grid-cols-3">
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
    <Card className="overflow-hidden rounded-4xl border-border bg-slate-950 text-white">
      <div className="relative grid aspect-[4/5] place-items-center overflow-hidden sm:aspect-video">
        {showVideo && stream ? (
          <ParticipantVideo muted={local} stream={stream} />
        ) : (
          <div className="grid gap-4 p-6 text-center">
            <div className="mx-auto grid size-24 place-items-center rounded-full bg-white/10 text-4xl font-medium">
              {participant.displayName.slice(0, 1).toUpperCase()}
            </div>
            {awaitingMedia && (
              <p className="max-w-56 text-sm leading-6 text-slate-300">
                {t('room.participant.waitingMedia')}
              </p>
            )}
          </div>
        )}

        <div className="absolute inset-x-0 bottom-0 h-28 bg-linear-to-t from-slate-950/80 to-transparent" />
        <div className="absolute left-3 right-3 top-3 flex items-start justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            {local && <Badge variant="info">{t('room.participant.you')}</Badge>}
            {screenOn && <Badge variant="warning">{t('room.participant.screen')}</Badge>}
          </div>
          <div className="flex gap-1">
            <Pill enabled={audioOn} label={t('room.participant.mic')} />
            <Pill enabled={cameraOn} label={t('room.participant.cam')} />
          </div>
        </div>

        <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-base font-medium">{participant.displayName}</p>
            <p className="text-xs text-slate-300">
              {t(`room.participant.roles.${participant.role}`)}
            </p>
          </div>
        </div>

        {audioOn && stream && !local && <ParticipantAudio stream={stream} />}
      </div>
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

function Pill({ enabled, label }: { readonly enabled: boolean; readonly label: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-medium',
        enabled ? 'bg-white/14 text-white' : 'bg-black/35 text-slate-300'
      )}
    >
      {label}
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
  t
}: {
  readonly microphoneEnabled: boolean
  readonly cameraEnabled: boolean
  readonly screenEnabled: boolean
  readonly onMicrophone: () => void
  readonly onCamera: () => void
  readonly onScreen: () => void
  readonly t: VoiceT
}) {
  return (
    <div className="sticky bottom-3 z-20 flex justify-center">
      <Card className="rounded-full border-border/80 bg-surface shadow-md">
        <CardContent className="flex flex-wrap items-center justify-center gap-2 p-2">
          <DockButton
            active={microphoneEnabled}
            label={microphoneEnabled ? t('room.controls.mute') : t('room.controls.unmute')}
            onClick={onMicrophone}
          />
          <DockButton
            active={cameraEnabled}
            label={cameraEnabled ? t('room.controls.cameraOff') : t('room.controls.cameraOn')}
            onClick={onCamera}
          />
          <DockButton
            active={screenEnabled}
            label={screenEnabled ? t('room.controls.stopShare') : t('room.controls.shareScreen')}
            onClick={onScreen}
          />
        </CardContent>
      </Card>
    </div>
  )
}

function DockButton({
  active,
  label,
  onClick
}: {
  readonly active: boolean
  readonly label: string
  readonly onClick: () => void
}) {
  return (
    <button
      className={cn(
        'inline-flex min-h-11 items-center justify-center rounded-full px-4 text-sm font-medium transition',
        active
          ? 'bg-muted text-foreground hover:bg-muted/80'
          : 'bg-destructive text-on-feedback hover:opacity-90'
      )}
      onClick={onClick}
      type="button"
    >
      {label}
    </button>
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
    <Card className="min-h-0 rounded-4xl border-border/80 bg-surface">
      <CardContent className="grid h-full gap-4 p-4">
        <div>
          <h2 className="text-lg font-medium text-foreground">{t('room.tech.title')}</h2>
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

        <div className="mt-auto grid gap-2">
          <Button className="rounded-full" onClick={onExportLogs} type="button" variant="outline">
            {t('room.tech.export')}
          </Button>
          <Button className="rounded-full" onClick={onClearLogs} type="button" variant="ghost">
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
    <div className="rounded-3xl border border-border bg-background p-3">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</p>
      <ul className="mt-2 grid gap-1 text-xs text-muted-foreground">
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
