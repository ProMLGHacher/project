import { useEffect, useRef, type ReactNode } from 'react'
import { useSharedFlow, useStateFlow, useViewModel, type PropsWithVM } from '@kvt/react'
import { useTranslation } from 'react-i18next'
import {
  Alert,
  AlertDescription,
  Badge,
  Button,
  Dialog,
  Field,
  FieldHint,
  Input,
  Label,
  NativeSelect,
  Switch,
  useToast,
  VideoAspectRatio
} from '@core/design-system'
import type { ParticipantRole } from '@features/room/domain/model/Participant'
import { useAttachMediaStream } from '@core/react/useAttachMediaStream'
import { PrejoinViewModel } from '../view_model/PrejoinViewModel'

export interface PrejoinModalProps {
  readonly open: boolean
  readonly roomId: string
  readonly role?: ParticipantRole
  readonly onJoined: () => void
}

export function PrejoinModal({
  _vm = PrejoinViewModel,
  open,
  roomId,
  role = 'participant',
  onJoined
}: PropsWithVM<PrejoinViewModel, PrejoinModalProps>): ReactNode {
  const viewModel = useViewModel(_vm, { key: `prejoin:${roomId}` })
  const uiState = useStateFlow(viewModel.uiState)
  const previewRef = useRef<HTMLVideoElement | null>(null)
  const { t } = useTranslation('voice')
  const toasts = useToast()
  const microphones = uiState.devices.filter((device) => device.kind === 'audio-input')
  const cameras = uiState.devices.filter((device) => device.kind === 'video-input')

  useEffect(() => {
    viewModel.onEvent({ type: 'room-configured', roomId, role })
  }, [role, roomId, viewModel])

  useSharedFlow(viewModel.uiEffect, (effect) => {
    switch (effect.type) {
      case 'joined':
        onJoined()
        break
      case 'load-failed':
      case 'join-failed':
      case 'preview-failed':
        toasts.error(t(effect.message))
        break
    }
  })

  useAttachMediaStream(previewRef, uiState.preview?.stream ?? null)

  return (
    <Dialog
      className="!my-0 w-full !max-w-[74rem] overflow-hidden rounded-3xl bg-surface-elevated !p-0 max-h-[calc(100dvh-1.5rem)] sm:max-h-[calc(100dvh-2rem)] xl:max-h-[min(44rem,calc(100dvh-2rem))]"
      open={open}
    >
      <div className="flex max-h-[calc(100dvh-1.5rem)] min-h-0 flex-col overflow-y-auto overscroll-contain bg-surface-elevated sm:max-h-[calc(100dvh-2rem)] xl:grid xl:grid-cols-[minmax(34rem,1fr)_minmax(20rem,22rem)] xl:overflow-hidden">
        <section className="flex shrink-0 flex-col border-b border-border/80 xl:min-h-0 xl:shrink xl:border-b-0 xl:border-r xl:overflow-y-auto xl:overscroll-contain">
          <div className="shrink-0 px-5 pt-5 sm:px-6 sm:pt-6">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="default">{t('prejoin.badge')}</Badge>
                <Badge className="max-w-full truncate sm:max-w-80">{uiState.roomId}</Badge>
              </div>
              <h2 className="mt-3 text-xl font-medium text-foreground sm:text-2xl">
                {t('prejoin.title')}
              </h2>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
                {t('prejoin.description')}
              </p>
            </div>
          </div>

          <div className="grid min-h-0 gap-4 px-5 py-5 sm:px-6 sm:py-6 xl:gap-5">
            <div className="relative h-52 overflow-hidden rounded-3xl border border-border/70 bg-slate-950 shadow-lg sm:h-64 xl:h-[22rem]">
              {uiState.cameraEnabled ? (
                <VideoAspectRatio
                  ref={previewRef}
                  aria-label={t('prejoin.cameraPreview')}
                  autoPlay
                  muted
                  playsInline
                  className="h-full w-full rounded-none object-cover"
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center p-8 text-center text-white">
                  <div className="grid size-20 place-items-center rounded-full bg-white/10 text-3xl font-medium leading-none sm:size-24 sm:text-4xl">
                    {uiState.displayName.value.trim().slice(0, 1).toUpperCase() || 'K'}
                  </div>
                </div>
              )}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <ToggleSummaryCard
                checked={uiState.micEnabled}
                description={uiState.micEnabled ? t('prejoin.micOn') : t('prejoin.micOff')}
                label={t('prejoin.microphone')}
                onChange={(enabled) => viewModel.onEvent({ type: 'microphone-toggled', enabled })}
              />
              <ToggleSummaryCard
                checked={uiState.cameraEnabled}
                description={
                  uiState.cameraEnabled ? t('prejoin.cameraOn') : t('prejoin.cameraOffShort')
                }
                label={t('prejoin.camera')}
                onChange={(enabled) => viewModel.onEvent({ type: 'camera-toggled', enabled })}
              />
            </div>
          </div>
        </section>

        <section className="flex shrink-0 flex-col xl:min-h-0 xl:max-h-full xl:shrink">
          <div className="px-5 py-5 sm:px-6 sm:py-6 xl:min-h-0 xl:flex-1 xl:overflow-y-auto xl:overscroll-contain">
            <div className="grid gap-4">
              {uiState.error && (
                <Alert className="rounded-3xl bg-transparent shadow-none backdrop-blur-none">
                  <AlertDescription>{t(uiState.error)}</AlertDescription>
                </Alert>
              )}

              <Field>
                <Label htmlFor="display-name">{t('prejoin.nameLabel')}</Label>
                <Input
                  id="display-name"
                  autoFocus
                  className="min-h-12 rounded-3xl bg-transparent px-4"
                  placeholder={t('prejoin.namePlaceholder')}
                  value={uiState.displayName.value}
                  onChange={(event) =>
                    viewModel.onEvent({ type: 'display-name-changed', value: event.target.value })
                  }
                />
                {uiState.displayName.showError && (
                  <FieldHint className="text-destructive">
                    {uiState.displayName.error ? t(uiState.displayName.error) : ''}
                  </FieldHint>
                )}
              </Field>

              <Field>
                <Label htmlFor="microphone">{t('prejoin.microphone')}</Label>
                <NativeSelect
                  id="microphone"
                  className="min-h-12 rounded-3xl bg-transparent px-4"
                  value={uiState.selectedMicrophoneId ?? ''}
                  onChange={(event) =>
                    viewModel.onEvent({
                      type: 'microphone-selected',
                      deviceId: event.target.value || null
                    })
                  }
                >
                  <option value="">{t('prejoin.defaultDevice')}</option>
                  {microphones.map((device) => (
                    <option key={device.id} value={device.id}>
                      {device.label}
                    </option>
                  ))}
                </NativeSelect>
              </Field>

              <Field>
                <Label htmlFor="camera">{t('prejoin.camera')}</Label>
                <NativeSelect
                  id="camera"
                  className="min-h-12 rounded-3xl bg-transparent px-4"
                  value={uiState.selectedCameraId ?? ''}
                  onChange={(event) =>
                    viewModel.onEvent({
                      type: 'camera-selected',
                      deviceId: event.target.value || null
                    })
                  }
                >
                  <option value="">{t('prejoin.defaultDevice')}</option>
                  {cameras.map((device) => (
                    <option key={device.id} value={device.id}>
                      {device.label}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
            </div>
          </div>

          <div className="shrink-0 border-t border-border/80 bg-surface-elevated px-5 py-5 sm:px-6">
            <Button
              className="min-h-12 w-full rounded-full"
              disabled={!uiState.joinButton.enabled || uiState.joinButton.loading}
              onClick={() => viewModel.onEvent({ type: 'join-pressed' })}
              type="button"
            >
              {uiState.joinButton.loading ? t('prejoin.joining') : t('prejoin.joinRoom')}
            </Button>
          </div>
        </section>
      </div>
    </Dialog>
  )
}

function ToggleSummaryCard({
  checked,
  label,
  description,
  onChange
}: {
  readonly checked: boolean
  readonly label: string
  readonly description: string
  readonly onChange: (checked: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-3xl border border-border/80 bg-transparent p-4">
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  )
}
