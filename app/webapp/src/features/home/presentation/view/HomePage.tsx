import type { ReactNode } from 'react'
import { useSharedFlow, useStateFlow, useViewModel, type PropsWithVM } from '@kvt/react'
import { useNavigate } from 'react-router'
import { useTranslation } from 'react-i18next'
import { useToast } from '@core/design-system'
import { HomeViewModel } from '../view_model/HomeViewModel'
import { CreateRoomCard, JoinRoomCard, RecentRoomsCard } from './HomeCards'

export function HomePage({ _vm = HomeViewModel }: PropsWithVM<HomeViewModel>): ReactNode {
  const viewModel = useViewModel(_vm)
  const uiState = useStateFlow(viewModel.uiState)
  const navigate = useNavigate()
  const { t } = useTranslation('voice')
  const toasts = useToast()

  useSharedFlow(viewModel.uiEffect, (effect) => {
    switch (effect.type) {
      case 'open-room':
        void navigate(`/rooms/${effect.roomId}`, { viewTransition: true })
        break
      case 'show-message':
        toasts.error(t(effect.message))
        break
    }
  })

  return (
    <section className="mx-auto grid min-h-screen w-full max-w-5xl place-items-center px-4 py-10">
      <div className="w-full">
        <h1 className="text-center text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          {t('home.title')}
        </h1>

        <div className="mt-10 grid gap-4 md:grid-cols-[minmax(0,1.35fr)_minmax(20rem,0.9fr)]">
          <CreateRoomCard
            enabled={Boolean(uiState.createRoomButtonState.enabled)}
            t={t}
            onCreate={() => viewModel.onEvent({ type: 'create-room-pressed' })}
          />
          <JoinRoomCard
            feedback={uiState.feedback}
            inputState={uiState.idOrLinkToJoinState}
            joinButtonState={uiState.joinButtonState}
            t={t}
            onInputChange={(value) =>
              viewModel.onEvent({ type: 'id-or-link-to-join-changed', value })
            }
            onJoin={() => viewModel.onEvent({ type: 'join-pressed' })}
          />
        </div>

        <div className="mt-4">
          <RecentRoomsCard
            rooms={uiState.recentRooms}
            t={t}
            onOpen={(roomId) => viewModel.onEvent({ type: 'recent-room-pressed', roomId })}
          />
        </div>
      </div>
    </section>
  )
}
