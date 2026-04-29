import { useEffect, useRef, type ReactNode, type RefObject } from 'react'
import { useKvtTheme } from '@kvt/theme'
import { useSharedFlow, useStateFlow, useViewModel, type PropsWithVM } from '@kvt/react'
import { useTranslation } from 'react-i18next'
import {
  Alert,
  AlertDescription,
  Button,
  Dialog,
  Field,
  FieldHint,
  Input,
  Label,
  NativeSelect,
  Switch,
  VideoAspectRatio,
  cn,
  useToast
} from '@core/design-system'
import { setLanguage, supportedLanguages, type SupportedLanguage } from '@core/i18n/config'
import { useAttachMediaStream } from '@core/react/useAttachMediaStream'
import { SettingsViewModel } from '../view_model/SettingsViewModel'

export interface SettingsModalProps {
  readonly open: boolean
  readonly onClose: () => void
}

export function SettingsModal({
  _vm = SettingsViewModel,
  open,
  onClose
}: PropsWithVM<SettingsViewModel, SettingsModalProps>): ReactNode {
  const viewModel = useViewModel(_vm)
  const uiState = useStateFlow(viewModel.uiState)
  const previewRef = useRef<HTMLVideoElement | null>(null)
  const { t, i18n } = useTranslation('common')
  const { resolvedMode, toggleMode } = useKvtTheme()
  const toasts = useToast()
  const microphones = uiState.devices.filter((device) => device.kind === 'audio-input')
  const cameras = uiState.devices.filter((device) => device.kind === 'video-input')

  useEffect(() => {
    if (open) {
      viewModel.onEvent({ type: 'opened' })
      return
    }

    viewModel.onEvent({ type: 'closed' })
  }, [open, viewModel])

  useSharedFlow(viewModel.uiEffect, (effect) => {
    if (effect.type === 'show-error') {
      toasts.error(t(effect.message))
    }
  })

  useAttachMediaStream(previewRef, uiState.preview?.stream ?? null)

  return (
    <Dialog
      className="animate-panel-in !my-0 w-full !max-w-[58rem] overflow-hidden rounded-[2rem] bg-surface-elevated !p-0 max-h-[calc(100dvh-1.5rem)]"
      open={open}
    >
      <div className="relative grid max-h-[calc(100dvh-1.5rem)] min-h-[30rem] overflow-hidden md:grid-cols-[14rem_minmax(0,1fr)]">
        <Button
          aria-label={t('settings.close')}
          className="absolute right-4 top-4 z-10 size-9 rounded-full p-0"
          onClick={onClose}
          size="icon"
          type="button"
          variant="ghost"
        >
          <CloseIcon />
        </Button>

        <aside className="flex min-h-0 flex-col justify-between border-b border-border/70 bg-background/54 p-4 md:border-b-0 md:border-r">
          <div className="flex flex-col gap-6 justify-start">
            <h2 className="mt-1 text-xl font-semibold text-foreground">{t('settings.title')}</h2>
            <nav className=" grid gap-2">
              <SettingsTabButton
                active={uiState.activeTab === 'profile'}
                icon={<UserIcon />}
                label={t('settings.tabs.profile')}
                onClick={() => viewModel.onEvent({ type: 'tab-selected', tab: 'profile' })}
              />
              <SettingsTabButton
                active={uiState.activeTab === 'media'}
                icon={<CameraIcon />}
                label={t('settings.tabs.media')}
                onClick={() => viewModel.onEvent({ type: 'tab-selected', tab: 'media' })}
              />
              <SettingsTabButton
                active={uiState.activeTab === 'appearance'}
                icon={<SparkIcon />}
                label={t('settings.tabs.appearance')}
                onClick={() => viewModel.onEvent({ type: 'tab-selected', tab: 'appearance' })}
              />
            </nav>
          </div>
          <div className="flex gap-2 items-center">
            <NativeSelect
              value={i18n.language}
              onChange={(event) => setLanguage(event.target.value as SupportedLanguage)}
            >
              {supportedLanguages.map((supportedLanguage) => (
                <option key={supportedLanguage} value={supportedLanguage}>
                  {supportedLanguage.toUpperCase()}
                </option>
              ))}
            </NativeSelect>
            <Button onClick={toggleMode} size="icon" variant="ghost">
              {resolvedMode === 'dark' ? <MoonIcon /> : <SunIcon />}
            </Button>
          </div>
        </aside>

        <section className="min-h-0 overflow-y-auto overscroll-contain p-5 pr-14 sm:p-6 sm:pr-16">
          {uiState.error && (
            <Alert className="mb-4 rounded-3xl">
              <AlertDescription>{t(uiState.error)}</AlertDescription>
            </Alert>
          )}

          {uiState.activeTab === 'profile' && (
            <ProfileSettings
              displayName={uiState.displayName}
              loading={uiState.loading}
              onDisplayNameChange={(value) =>
                viewModel.onEvent({ type: 'display-name-changed', value })
              }
            />
          )}

          {uiState.activeTab === 'media' && (
            <MediaSettings
              cameraEnabled={uiState.cameraEnabled}
              cameras={cameras}
              microphones={microphones}
              micEnabled={uiState.micEnabled}
              previewRef={previewRef}
              selectedCameraId={uiState.selectedCameraId}
              selectedMicrophoneId={uiState.selectedMicrophoneId}
              previewAvailable={Boolean(uiState.preview?.previewAvailable)}
              onCameraChange={(enabled) => viewModel.onEvent({ type: 'camera-toggled', enabled })}
              onCameraSelect={(deviceId) =>
                viewModel.onEvent({ type: 'camera-selected', deviceId })
              }
              onMicrophoneChange={(enabled) =>
                viewModel.onEvent({ type: 'microphone-toggled', enabled })
              }
              onMicrophoneSelect={(deviceId) =>
                viewModel.onEvent({ type: 'microphone-selected', deviceId })
              }
            />
          )}

          {uiState.activeTab === 'appearance' && (
            <AppearanceSettings
              language={i18n.language}
              mode={resolvedMode}
              onLanguageChange={setLanguage}
              onToggleMode={toggleMode}
            />
          )}
        </section>
      </div>
    </Dialog>
  )
}

function SettingsTabButton({
  active,
  icon,
  label,
  onClick
}: {
  readonly active: boolean
  readonly icon: ReactNode
  readonly label: string
  readonly onClick: () => void
}) {
  return (
    <button
      className={cn(
        'flex min-h-11 items-center gap-3 rounded-2xl px-3 text-left text-sm font-semibold transition',
        active ? 'bg-primary text-primary-foreground shadow-sm' : 'text-foreground hover:bg-muted'
      )}
      onClick={onClick}
      type="button"
    >
      {icon}
      <span>{label}</span>
    </button>
  )
}

function ProfileSettings({
  displayName,
  loading,
  onDisplayNameChange
}: {
  readonly displayName: string
  readonly loading: boolean
  readonly onDisplayNameChange: (value: string) => void
}) {
  const { t } = useTranslation('common')

  return (
    <div className="max-w-2xl">
      <h3 className="text-2xl font-semibold text-foreground">{t('settings.profile.title')}</h3>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">
        {t('settings.profile.description')}
      </p>

      <Field className="mt-5">
        <Label htmlFor="settings-display-name">{t('settings.profile.name')}</Label>
        <Input
          id="settings-display-name"
          className="min-h-12 rounded-3xl"
          disabled={loading}
          value={displayName}
          onChange={(event) => onDisplayNameChange(event.target.value)}
        />
        <FieldHint>{t('settings.profile.hint')}</FieldHint>
      </Field>
    </div>
  )
}

function MediaSettings({
  cameraEnabled,
  cameras,
  microphones,
  micEnabled,
  previewRef,
  selectedCameraId,
  selectedMicrophoneId,
  previewAvailable,
  onCameraChange,
  onCameraSelect,
  onMicrophoneChange,
  onMicrophoneSelect
}: {
  readonly cameraEnabled: boolean
  readonly cameras: readonly { id: string; label: string }[]
  readonly microphones: readonly { id: string; label: string }[]
  readonly micEnabled: boolean
  readonly previewRef: RefObject<HTMLVideoElement | null>
  readonly selectedCameraId: string | null
  readonly selectedMicrophoneId: string | null
  readonly previewAvailable: boolean
  readonly onCameraChange: (enabled: boolean) => void
  readonly onCameraSelect: (deviceId: string | null) => void
  readonly onMicrophoneChange: (enabled: boolean) => void
  readonly onMicrophoneSelect: (deviceId: string | null) => void
}) {
  const { t } = useTranslation('common')

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_19rem]">
      <div>
        <h3 className="text-2xl font-semibold text-foreground">{t('settings.media.title')}</h3>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          {t('settings.media.description')}
        </p>

        <div className="mt-5 grid gap-3">
          <ToggleRow
            checked={micEnabled}
            description={t('settings.media.micHint')}
            label={t('settings.media.microphone')}
            onChange={onMicrophoneChange}
          />
          <ToggleRow
            checked={cameraEnabled}
            description={t('settings.media.cameraHint')}
            label={t('settings.media.camera')}
            onChange={onCameraChange}
          />
          <Field>
            <Label htmlFor="settings-microphone">{t('settings.media.microphone')}</Label>
            <NativeSelect
              id="settings-microphone"
              className="min-h-12 rounded-3xl"
              value={selectedMicrophoneId ?? ''}
              onChange={(event) => onMicrophoneSelect(event.target.value || null)}
            >
              <option value="">{t('settings.media.defaultDevice')}</option>
              {microphones.map((device) => (
                <option key={device.id} value={device.id}>
                  {device.label}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field>
            <Label htmlFor="settings-camera">{t('settings.media.camera')}</Label>
            <NativeSelect
              id="settings-camera"
              className="min-h-12 rounded-3xl"
              value={selectedCameraId ?? ''}
              onChange={(event) => onCameraSelect(event.target.value || null)}
            >
              <option value="">{t('settings.media.defaultDevice')}</option>
              {cameras.map((device) => (
                <option key={device.id} value={device.id}>
                  {device.label}
                </option>
              ))}
            </NativeSelect>
          </Field>
        </div>
      </div>

      <div className="overflow-hidden rounded-[1.75rem] border border-border/70 bg-slate-950">
        {cameraEnabled && previewAvailable ? (
          <VideoAspectRatio
            ref={previewRef}
            autoPlay
            muted
            playsInline
            className="h-full min-h-56 w-full object-cover"
          />
        ) : (
          <div className="grid min-h-56 place-items-center p-6 text-center text-white">
            <div>
              <div className="mx-auto grid size-20 place-items-center rounded-full bg-white/12 text-3xl font-semibold">
                K
              </div>
              <p className="mt-4 text-sm text-slate-300">{t('settings.media.previewOff')}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function AppearanceSettings({
  language,
  mode,
  onLanguageChange,
  onToggleMode
}: {
  readonly language: string
  readonly mode: string
  readonly onLanguageChange: (language: SupportedLanguage) => void
  readonly onToggleMode: () => void
}) {
  const { t } = useTranslation('common')

  return (
    <div className="max-w-2xl">
      <h3 className="text-2xl font-semibold text-foreground">{t('settings.appearance.title')}</h3>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">
        {t('settings.appearance.description')}
      </p>

      <div className="mt-5 grid gap-3">
        <Field>
          <Label htmlFor="settings-language">{t('settings.appearance.language')}</Label>
          <NativeSelect
            id="settings-language"
            className="min-h-12 rounded-3xl"
            value={language}
            onChange={(event) => onLanguageChange(event.target.value as SupportedLanguage)}
          >
            {supportedLanguages.map((supportedLanguage) => (
              <option key={supportedLanguage} value={supportedLanguage}>
                {supportedLanguage.toUpperCase()}
              </option>
            ))}
          </NativeSelect>
        </Field>

        <button
          className="flex min-h-14 items-center justify-between rounded-3xl border border-border/80 bg-surface-overlay px-4 text-left transition hover:bg-surface-elevated"
          onClick={onToggleMode}
          type="button"
        >
          <span>
            <span className="block text-sm font-semibold text-foreground">
              {t('settings.appearance.theme')}
            </span>
            <span className="mt-1 block text-xs text-muted-foreground">
              {mode === 'dark' ? t('settings.appearance.dark') : t('settings.appearance.light')}
            </span>
          </span>
          {mode === 'dark' ? <MoonIcon /> : <SunIcon />}
        </button>
      </div>
    </div>
  )
}

function ToggleRow({
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
    <div className="flex items-center justify-between gap-4 rounded-3xl border border-border/80 bg-surface-overlay px-4 py-3">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-foreground">{label}</p>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  )
}

export function SettingsIcon() {
  return (
    <svg aria-hidden="true" className="size-5" fill="none" viewBox="0 0 24 24">
      <path
        d="M12 15.25A3.25 3.25 0 1 0 12 8.75a3.25 3.25 0 0 0 0 6.5Z"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="M18.3 13.25c.08-.4.12-.82.12-1.25s-.04-.85-.12-1.25l2.1-1.6-2-3.46-2.48 1a6.77 6.77 0 0 0-2.16-1.25L13.4 2.8H9.4l-.36 2.64A6.77 6.77 0 0 0 6.88 6.7l-2.48-1-2 3.46 2.1 1.6c-.08.4-.12.82-.12 1.25s.04.85.12 1.25l-2.1 1.6 2 3.46 2.48-1c.64.54 1.37.97 2.16 1.25l.36 2.64h4l.36-2.64a6.77 6.77 0 0 0 2.16-1.25l2.48 1 2-3.46-2.1-1.6Z"
        stroke="currentColor"
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

function UserIcon() {
  return (
    <svg aria-hidden="true" className="size-5" fill="none" viewBox="0 0 24 24">
      <path
        d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4.5 20a7.5 7.5 0 0 1 15 0"
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

function SparkIcon() {
  return (
    <svg aria-hidden="true" className="size-5" fill="none" viewBox="0 0 24 24">
      <path
        d="M12 3.5 13.8 9l5.7 1.8-5.7 1.8L12 18l-1.8-5.4-5.7-1.8L10.2 9 12 3.5ZM18 16l.75 2.25L21 19l-2.25.75L18 22l-.75-2.25L15 19l2.25-.75L18 16Z"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  )
}

function SunIcon() {
  return (
    <svg aria-hidden="true" className="size-5" fill="none" viewBox="0 0 24 24">
      <path
        d="M12 4V2.5M12 21.5V20M4 12H2.5M21.5 12H20M6.34 6.34 5.28 5.28M18.72 18.72l-1.06-1.06M17.66 6.34l1.06-1.06M5.28 18.72l1.06-1.06M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.8"
      />
    </svg>
  )
}

function MoonIcon() {
  return (
    <svg aria-hidden="true" className="size-5" fill="none" viewBox="0 0 24 24">
      <path
        d="M19.25 15.74A7.7 7.7 0 0 1 8.26 4.75 7.85 7.85 0 1 0 19.25 15.74Z"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  )
}
