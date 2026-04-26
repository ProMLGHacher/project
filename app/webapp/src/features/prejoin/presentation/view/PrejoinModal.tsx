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
      className="max-h-[calc(100dvh-1rem)] max-w-6xl overflow-hidden rounded-4xl p-0"
      open={open}
    >
      <div className="grid min-h-[36rem] max-h-[calc(100dvh-1rem)] overflow-hidden lg:grid-cols-[minmax(0,1.15fr)_24rem]">
        <section className="flex min-h-0 flex-col bg-background">
          <div className="flex items-center justify-between gap-3 border-b border-border/80 px-4 py-4 sm:px-6">
            <div className="min-w-0">
              <p className="text-lg font-medium text-foreground">{t('prejoin.title')}</p>
              <p className="truncate text-sm text-muted-foreground">{t('prejoin.description')}</p>
            </div>
            <Badge variant="default">{uiState.roomId}</Badge>
          </div>

          <div className="grid min-h-0 flex-1 items-center gap-6 px-4 py-4 sm:px-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
            <div className="grid gap-4">
              <div className="overflow-hidden rounded-4xl bg-slate-950 shadow-lg">
                {uiState.cameraEnabled ? (
                  <VideoAspectRatio
                    ref={previewRef}
                    aria-label={t('prejoin.cameraPreview')}
                    autoPlay
                    muted
                    playsInline
                    className="aspect-[4/3] rounded-none object-cover"
                  />
                ) : (
                  <div className="grid aspect-[4/3] place-items-center p-8 text-center text-white">
                    <div>
                      <div className="mx-auto grid size-24 place-items-center rounded-full bg-white/10 text-4xl font-medium">
                        {uiState.displayName.value.trim().slice(0, 1).toUpperCase() || 'K'}
                      </div>
                      <p className="mt-5 text-sm text-slate-300">{t('prejoin.cameraOff')}</p>
                    </div>
                  </div>
                )}
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <StatusChip
                  enabled={uiState.micEnabled}
                  label={t('prejoin.microphone')}
                  value={uiState.micEnabled ? t('prejoin.micOn') : t('prejoin.micOff')}
                />
                <StatusChip
                  enabled={uiState.cameraEnabled}
                  label={t('prejoin.camera')}
                  value={
                    uiState.cameraEnabled ? t('prejoin.cameraOn') : t('prejoin.cameraOffShort')
                  }
                />
              </div>
            </div>

            <div className="grid gap-3">
              <QuickToggleCard
                checked={uiState.micEnabled}
                description={uiState.micEnabled ? t('prejoin.micOn') : t('prejoin.micOff')}
                label={t('prejoin.microphone')}
                onChange={(enabled) => viewModel.onEvent({ type: 'microphone-toggled', enabled })}
              />
              <QuickToggleCard
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

        <section className="flex min-h-0 flex-col border-l border-border/80 bg-surface">
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">
            <DialogHeader className="mb-5">
              <p className="text-xl font-medium text-foreground">{t('prejoin.badge')}</p>
            </DialogHeader>

            <div className="grid gap-4">
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
                  className="min-h-12 rounded-3xl px-4"
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
                  className="min-h-12 rounded-3xl px-4"
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
                  className="min-h-12 rounded-3xl px-4"
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

          <DialogFooter className="border-t border-border/80 bg-surface px-4 py-4 sm:px-5">
            <Button
              className="w-full min-h-12 rounded-full"
              disabled={!uiState.joinButton.enabled || uiState.joinButton.loading}
              onClick={() => viewModel.onEvent({ type: 'join-pressed' })}
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

function QuickToggleCard({
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
    <Card className="rounded-4xl border-border/80">
      <CardContent className="flex items-center justify-between gap-4 p-4">
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground">{label}</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p>
        </div>
        <Switch checked={checked} onCheckedChange={onChange} />
      </CardContent>
    </Card>
  )
}

function StatusChip({
  enabled,
  label,
  value
}: {
  readonly enabled: boolean
  readonly label: string
  readonly value: string
}) {
  return (
    <div className="flex items-center gap-3 rounded-full border border-border/80 bg-surface px-4 py-3">
      <span
        className={
          enabled
            ? 'inline-flex size-2 rounded-full bg-success'
            : 'inline-flex size-2 rounded-full bg-muted-foreground'
        }
      />
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="truncate text-xs text-muted-foreground">{value}</p>
      </div>
    </div>
  )
}
