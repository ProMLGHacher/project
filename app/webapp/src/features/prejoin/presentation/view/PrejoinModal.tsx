import { useEffect, useRef, type ReactNode } from 'react'
import { useSharedFlow, useStateFlow, useViewModel, type PropsWithVM } from '@kvt/react'
import { useTranslation } from 'react-i18next'
import {
  Alert,
  AlertDescription,
  Badge,
  Button,
  Card,
  CardContent,
  Dialog,
  DialogFooter,
  DialogHeader,
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
import { PrejoinViewModel } from '../view_model/PrejoinViewModel'
import { useAttachMediaStream } from '@core/react/useAttachMediaStream'

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
      className="max-h-[calc(100dvh-1rem)] max-w-5xl overflow-hidden rounded-4xl p-0"
      open={open}
    >
      <div className="grid max-h-[calc(100dvh-1rem)] min-h-[32rem] overflow-hidden lg:grid-cols-[minmax(0,1.05fr)_minmax(22rem,0.95fr)]">
        <section className="relative bg-linear-to-br from-slate-950 via-slate-900 to-slate-800 p-4 sm:p-5 md:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Badge variant="info">{t('prejoin.badge')}</Badge>
            <Badge className="max-w-full truncate bg-white/10 text-white" variant="secondary">
              {uiState.roomId}
            </Badge>
          </div>

          <div className="mt-4 grid h-full content-start gap-4 lg:mt-6">
            <div className="overflow-hidden rounded-[calc(var(--radius-2xl)+0.25rem)] border border-white/10 bg-slate-950/60 shadow-2xl shadow-slate-950/40">
              {uiState.cameraEnabled ? (
                <VideoAspectRatio
                  ref={previewRef}
                  aria-label={t('prejoin.cameraPreview')}
                  autoPlay
                  muted
                  playsInline
                  className="aspect-[4/5] min-h-72 rounded-none object-cover sm:aspect-video lg:aspect-[4/5] lg:min-h-[34rem]"
                />
              ) : (
                <div className="grid aspect-[4/5] min-h-72 place-items-center p-8 text-center text-slate-200 sm:aspect-video lg:aspect-[4/5] lg:min-h-[34rem]">
                  <div>
                    <div className="mx-auto grid size-20 place-items-center rounded-full bg-white/10 text-3xl font-black">
                      {uiState.displayName.value.trim().slice(0, 1).toUpperCase() || 'K'}
                    </div>
                    <p className="mt-5 max-w-56 text-sm leading-6 text-slate-300">
                      {t('prejoin.cameraOff')}
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="hidden gap-3 lg:grid">
              <PreviewPill
                description={uiState.micEnabled ? t('prejoin.micOn') : t('prejoin.micOff')}
                label={t('prejoin.microphone')}
              />
              <PreviewPill
                description={
                  uiState.cameraEnabled ? t('prejoin.cameraOn') : t('prejoin.cameraOffShort')
                }
                label={t('prejoin.camera')}
              />
            </div>
          </div>
        </section>

        <section className="flex min-h-0 flex-col bg-surface">
          <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5 md:p-6">
            <DialogHeader>
              <h2 className="font-display text-2xl font-black tracking-tight sm:text-3xl">
                {t('prejoin.title')}
              </h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {t('prejoin.description')}
              </p>
            </DialogHeader>

            <div className="grid gap-4 sm:gap-5">
              {uiState.error && (
                <Alert>
                  <AlertDescription>{t(uiState.error)}</AlertDescription>
                </Alert>
              )}

              <Field>
                <Label htmlFor="display-name">{t('prejoin.nameLabel')}</Label>
                <Input
                  id="display-name"
                  autoFocus
                  className="min-h-13"
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

              <Card className="rounded-[calc(var(--radius-2xl)+0.25rem)] border-border/70">
                <CardContent className="grid gap-4 p-4">
                  <MediaToggle
                    checked={uiState.micEnabled}
                    label={t('prejoin.microphone')}
                    description={uiState.micEnabled ? t('prejoin.micOn') : t('prejoin.micOff')}
                    onChange={(enabled) =>
                      viewModel.onEvent({ type: 'microphone-toggled', enabled })
                    }
                  />
                  <MediaToggle
                    checked={uiState.cameraEnabled}
                    label={t('prejoin.camera')}
                    description={
                      uiState.cameraEnabled ? t('prejoin.cameraOn') : t('prejoin.cameraOffShort')
                    }
                    onChange={(enabled) => viewModel.onEvent({ type: 'camera-toggled', enabled })}
                  />
                </CardContent>
              </Card>

              <div className="grid gap-4">
                <Field>
                  <Label htmlFor="microphone">{t('prejoin.microphone')}</Label>
                  <NativeSelect
                    id="microphone"
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
          </div>

          <DialogFooter className="border-t border-border/80 bg-surface-overlay p-4 backdrop-blur-sm sm:p-5">
            <Button
              className="w-full rounded-3xl"
              disabled={!uiState.joinButton.enabled || uiState.joinButton.loading}
              onClick={() => viewModel.onEvent({ type: 'join-pressed' })}
              size="lg"
              type="button"
            >
              {uiState.joinButton.loading ? t('prejoin.joining') : t('prejoin.joinRoom')}
            </Button>
          </DialogFooter>
        </section>
      </div>
    </Dialog>
  )
}

interface MediaToggleProps {
  readonly checked: boolean
  readonly label: string
  readonly description: string
  readonly onChange: (checked: boolean) => void
}

function MediaToggle({ checked, label, description, onChange }: MediaToggleProps) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-border/70 bg-muted/35 px-4 py-3">
      <div className="min-w-0">
        <p className="text-sm font-bold text-surface-foreground">{label}</p>
        <p className="text-xs leading-5 text-muted-foreground">{description}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  )
}

function PreviewPill({
  label,
  description
}: {
  readonly label: string
  readonly description: string
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/6 px-4 py-3 text-sm text-white backdrop-blur-sm">
      <p className="font-bold">{label}</p>
      <p className="mt-1 text-xs text-white/70">{description}</p>
    </div>
  )
}
