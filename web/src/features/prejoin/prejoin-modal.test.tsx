import { render } from '@testing-library/react'
import { screen } from '@testing-library/dom'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import { PrejoinModal } from '@/features/prejoin/prejoin-modal'

describe('PrejoinModal', () => {
  it('submits the selected prejoin preferences', async () => {
    const onJoin = vi.fn()
    render(<PrejoinModal open onJoin={onJoin} />)

    await userEvent.type(screen.getByPlaceholderText(/how people will see you/i), 'Araik')
    const switches = screen.getAllByRole('switch')
    await userEvent.click(switches[0])
    await userEvent.click(screen.getByRole('button', { name: /join room/i }))

    expect(onJoin).toHaveBeenCalledWith({
      displayName: 'Araik',
      micEnabled: false,
      cameraEnabled: false
    })
  })
})
