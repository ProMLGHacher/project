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

  it('creates a room and routes to the host invite', async () => {
    vi.mocked(conferenceApi.createRoom).mockResolvedValue({
      roomId: 'room-1',
      hostInviteToken: 'host-token',
      participantInviteToken: 'participant-token',
      hostInviteUrl: 'http://localhost/invite/host-token',
      participantInviteUrl: 'http://localhost/invite/participant-token'
    })

    render(
      <MemoryRouter>
        <LandingPage />
      </MemoryRouter>
    )

    await userEvent.click(screen.getByRole('button', { name: /create room/i }))

    await waitFor(() => {
      expect(navigate).toHaveBeenCalledWith('/invite/host-token')
    })
  })

  it('extracts a token from a pasted invite URL', async () => {
    render(
      <MemoryRouter>
        <LandingPage />
      </MemoryRouter>
    )

    await userEvent.type(screen.getByPlaceholderText(/https:\/\/app.local\/invite/i), 'https://app.local/invite/demo-token')
    await userEvent.click(screen.getByRole('button', { name: /join invite/i }))

    expect(navigate).toHaveBeenCalledWith('/invite/demo-token')
  })
})
