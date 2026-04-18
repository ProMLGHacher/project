import { render } from '@testing-library/react'
import { screen, waitFor } from '@testing-library/dom'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { vi } from 'vitest'
import { LandingPage } from '@/features/home/landing-page'
import { conferenceApi } from '@/lib/api'

const navigate = vi.fn()

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return {
    ...actual,
    useNavigate: () => navigate
  }
})

vi.mock('@/lib/api', () => ({
  conferenceApi: {
    createRoom: vi.fn()
  }
}))

describe('LandingPage', () => {
  beforeEach(() => {
    navigate.mockReset()
    vi.mocked(conferenceApi.createRoom).mockReset()
  })

  it('creates a room and routes to the host room join flow', async () => {
    vi.mocked(conferenceApi.createRoom).mockResolvedValue({
      roomId: 'room-1'
    })

    render(
      <MemoryRouter>
        <LandingPage />
      </MemoryRouter>
    )

    await userEvent.click(screen.getByRole('button', { name: /create room/i }))

    await waitFor(() => {
      expect(navigate).toHaveBeenCalledWith('/rooms/room-1/join?role=host')
    })
  })

  it('extracts a room id from a pasted room join URL', async () => {
    render(
      <MemoryRouter>
        <LandingPage />
      </MemoryRouter>
    )

    await userEvent.type(screen.getByRole('textbox'), 'https://kvt.araik.dev/rooms/demo-room/join')
    await userEvent.click(screen.getByRole('button', { name: /join room/i }))

    await waitFor(() => {
      expect(navigate).toHaveBeenCalledWith('/rooms/demo-room/join')
    })
  })
})
