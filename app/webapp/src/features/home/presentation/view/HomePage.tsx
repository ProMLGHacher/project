import type { ReactNode } from 'react'
import { useStateFlow, useViewModel, type PropsWithVM } from '@kvt/react'
import { HomeViewModel } from '../view_model/HomeViewModel'
import { Button, Input } from '@core/design-system'

export function HomePage({ _vm = HomeViewModel }: PropsWithVM<HomeViewModel>): ReactNode {
  const viewModel = useViewModel(_vm)
  const uiState = useStateFlow(viewModel.uiState)
  return (
    <div>
      <Input
        type="text"
        value={uiState.idOrLinkToJoinState.value}
        onChange={(e) =>
          viewModel.onEvent({ type: 'id-or-link-to-join-changed', value: e.target.value })
        }
      />
      <Button onClick={() => viewModel.onEvent({ type: 'join-pressed' })}>Join</Button>
      <Button onClick={() => viewModel.onEvent({ type: 'create-room-pressed' })}>
        Create Room
      </Button>
    </div>
  )
}
