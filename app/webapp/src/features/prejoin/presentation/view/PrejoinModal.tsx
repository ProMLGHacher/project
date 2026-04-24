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
      className="max-h-dvh max-w-4xl overflow-y-auto rounded-3xl p-0 sm:rounded-4xl"
      open={open}
    >
      <div className="grid overflow-hidden md:grid-cols-2">
        <section className="bg-muted/60 p-4 sm:p-5 md:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Badge variant="info">{t('prejoin.badge')}</Badge>
            <Badge className="max-w-full truncate">{uiState.roomId}</Badge>
          </div>

          <div className="mt-4 overflow-hidden rounded-2xl border border-border bg-slate-950 sm:mt-5">
            {uiState.cameraEnabled ? (
              <VideoAspectRatio
                ref={previewRef}
                aria-label={t('prejoin.cameraPreview')}
                autoPlay
                muted
                playsInline
                className="aspect-video max-h-80 rounded-none object-cover md:max-h-none"
              />
            ) : (
              <div className="grid aspect-video place-items-center p-8 text-center text-slate-300">
                <div>
                  <div className="mx-auto grid size-16 place-items-center rounded-full bg-white/10 text-2xl font-black">
                    {uiState.displayName.value.trim().slice(0, 1).toUpperCase() || 'K'}
                  </div>
                  <p className="mt-4 text-sm">{t('prejoin.cameraOff')}</p>
                </div>
              </div>
            )}
          </div>
        </section>

        <section className="p-4 sm:p-5 md:p-6">
          <DialogHeader>
            <h2 className="font-display text-xl font-black tracking-tight sm:text-2xl">
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

            <Card>
              <CardContent className="grid gap-4 p-4">
                <MediaToggle
                  checked={uiState.micEnabled}
                  label={t('prejoin.microphone')}
                  description={uiState.micEnabled ? t('prejoin.micOn') : t('prejoin.micOff')}
                  onChange={(enabled) => viewModel.onEvent({ type: 'microphone-toggled', enabled })}
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

          <DialogFooter>
            <Button
              className="w-full rounded-2xl"
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
    <div className="flex items-center justify-between gap-4">
      <div>
        <p className="text-sm font-bold text-surface-foreground">{label}</p>
        <p className="text-xs leading-5 text-muted-foreground">{description}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  )
}
