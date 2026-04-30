import { useCallback, useEffect, useMemo, type ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router'
import { useSharedFlow, useStateFlow, useViewModel, type PropsWithVM } from '@kvt/react'
import { useTranslation } from 'react-i18next'
import { useToast } from '@core/design-system'
import { PrejoinModal } from '@features/prejoin/presentation/view/PrejoinModal'
import { SettingsModalHost } from '@features/settings/presentation/view/SettingsModal'
import { RoomViewModel } from '../view_model/RoomViewModel'
import { ConferenceStage } from './ConferenceStage'
import { RoomBottomChrome } from './RoomBottomChrome'
import { RoomErrorState } from './RoomErrorState'
import { RoomFloatingPanel } from './RoomFloatingPanel'
import { RoomChatPanel } from './chat/RoomChatPanel'
import { downloadTextFile } from './download-text-file'

export function RoomPage({ _vm = RoomViewModel }: PropsWithVM<RoomViewModel>): ReactNode {
  const { roomId = '' } = useParams()
  const navigate = useNavigate()
  const viewModel = useViewModel(_vm, { key: `room:${roomId}` })
  const uiState = useStateFlow(viewModel.uiState)
  const toasts = useToast()
  const { t } = useTranslation('voice')
  const localSlotState = useMemo(
    () => ({
      audio: uiState.microphone.enabled,
      camera: uiState.camera.enabled,
      screen: uiState.screenShare.enabled
    }),
    [uiState.camera.enabled, uiState.microphone.enabled, uiState.screenShare.enabled]
  )
  const onPin = useCallback(
    (tileId: string) => viewModel.onEvent({ type: 'tile-pin-toggled', tileId }),
    [viewModel]
  )
  const onChatDraftChange = useCallback(
    (value: string) => viewModel.onEvent({ type: 'chat-draft-changed', value }),
    [viewModel]
  )
  const onChatReaction = useCallback(
    (messageId: string, emoji: string) =>
      viewModel.onEvent({ type: 'chat-reaction-toggled', messageId, emoji }),
    [viewModel]
  )
  const onChatReply = useCallback(
    (messageId: string) => viewModel.onEvent({ type: 'chat-reply-started', messageId }),
    [viewModel]
  )
  const onChatReplyPreview = useCallback(
    (messageId: string) => viewModel.onEvent({ type: 'chat-reply-preview-pressed', messageId }),
    [viewModel]
  )
  const onChatReplyCancel = useCallback(
    () => viewModel.onEvent({ type: 'chat-reply-cancelled' }),
    [viewModel]
  )
  const onChatSend = useCallback(() => viewModel.onEvent({ type: 'chat-message-sent' }), [viewModel])
  const onChatLatestVisible = useCallback(
    () => viewModel.onEvent({ type: 'chat-latest-visible' }),
    [viewModel]
  )
  const onChatFileSelected = useCallback(
    (file: File) => viewModel.onEvent({ type: 'chat-file-selected', file }),
    [viewModel]
  )
  const onChatEdit = useCallback(
    (messageId: string) => viewModel.onEvent({ type: 'chat-edit-started', messageId }),
    [viewModel]
  )
  const onChatEditCancel = useCallback(
    () => viewModel.onEvent({ type: 'chat-edit-cancelled' }),
    [viewModel]
  )
  const onChatEditDraftChange = useCallback(
    (value: string) => viewModel.onEvent({ type: 'chat-edit-draft-changed', value }),
    [viewModel]
  )
  const onChatEditSubmit = useCallback(
    (messageId: string) => viewModel.onEvent({ type: 'chat-edit-submitted', messageId }),
    [viewModel]
  )
  const onChatDelete = useCallback(
    (messageId: string) => viewModel.onEvent({ type: 'chat-message-deleted', messageId }),
    [viewModel]
  )

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
    <section className="relative mx-auto flex h-dvh min-h-0 w-full flex-col overflow-hidden px-2 py-2 sm:px-3 md:px-4">
      {uiState.error ? (
        <RoomErrorState
          actionLabel={t(uiState.error.actionLabel)}
          description={t(uiState.error.description)}
          title={t(uiState.error.title)}
          onAction={() => viewModel.onEvent({ type: 'go-home-pressed' })}
        />
      ) : (
        <>
          <div className="grid min-h-0 flex-1 gap-3 transition-[grid-template-columns] duration-300 lg:grid-cols-[minmax(0,1fr)_auto]">
            <ConferenceStage
              key={`stage:${roomId}`}
              localMediaStreams={uiState.localMediaStreams}
              localParticipantId={uiState.localParticipantId}
              localSlotState={localSlotState}
              participants={uiState.participants}
              pinnedTileId={uiState.pinnedTileId}
              remoteMediaStreams={uiState.remoteMediaStreams}
              speakingParticipantIds={uiState.speakingParticipantIds}
              t={t}
              onPin={onPin}
            />
            {uiState.chat.open && (
              <RoomChatPanel
                chat={uiState.chat}
                localParticipantId={uiState.localParticipantId}
                t={t}
                onDelete={onChatDelete}
                onDraftChange={onChatDraftChange}
                onEdit={onChatEdit}
                onEditCancel={onChatEditCancel}
                onEditDraftChange={onChatEditDraftChange}
                onEditSubmit={onChatEditSubmit}
                onFileSelected={onChatFileSelected}
                onLatestVisible={onChatLatestVisible}
                onReaction={onChatReaction}
                onReply={onChatReply}
                onReplyCancel={onChatReplyCancel}
                onReplyPreview={onChatReplyPreview}
                onSend={onChatSend}
              />
            )}
          </div>

          <RoomFloatingPanel
            activePanel={uiState.activePanel === 'chat' ? null : uiState.activePanel}
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
            t={t}
            onCamera={() => viewModel.onEvent({ type: 'camera-toggled' })}
            onCopy={() => viewModel.onEvent({ type: 'copy-link-pressed' })}
            onLeave={() => viewModel.onEvent({ type: 'leave-pressed' })}
            onMicrophone={() => viewModel.onEvent({ type: 'microphone-toggled' })}
            onPanelToggle={(panel) => viewModel.onEvent({ type: 'panel-toggled', panel })}
            onScreen={() => viewModel.onEvent({ type: 'screen-share-toggled' })}
            onSettings={() => viewModel.onEvent({ type: 'settings-opened' })}
          />
        </>
      )}

      <PrejoinModal
        open={uiState.prejoinOpen && Boolean(uiState.roomId)}
        role="host"
        roomId={uiState.roomId}
        onJoined={() => viewModel.onEvent({ type: 'prejoin-completed' })}
      />
      <SettingsModalHost
        open={uiState.settingsOpen}
        viewModelKey={`settings:room:${roomId}`}
        onClose={() => viewModel.onEvent({ type: 'settings-closed' })}
      />
    </section>
  )
}
