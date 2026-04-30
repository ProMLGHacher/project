import type { TFunction } from 'i18next'
import type { RoomPanel } from '../model/RoomState'
import { SettingsIcon } from '@features/settings/presentation/view/SettingsModal'
import { BottomDock } from './BottomDock'
import { ChatIcon, CodeIcon, CopyIcon, IconButton, InfoIcon, ParticipantsIcon } from './room-icons'

type VoiceT = TFunction<'voice'>

export interface RoomBottomChromeProps {
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
}

export function RoomBottomChrome({
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
}: RoomBottomChromeProps) {
  return (
    <div className="pointer-events-none z-30 mx-auto grid w-full max-w-400 gap-3 pt-3 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
      <div className="pointer-events-auto flex h-full min-w-0 items-center justify-center md:justify-start">
        <div className="flex max-w-full items-center gap-2 rounded-full border border-border bg-surface p-2 text-foreground shadow-2xl">
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

      <div className="pointer-events-auto flex justify-center md:items-center md:justify-end">
        <div className="flex items-center gap-2 rounded-full border border-border bg-surface p-2 text-foreground shadow-2xl">
          <IconButton
            active={activePanel === 'chat'}
            label={t('room.panels.chat')}
            onClick={() => onPanelToggle('chat')}
          >
            <ChatIcon />
          </IconButton>
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
