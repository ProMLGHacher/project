import { render, waitFor } from '@testing-library/react'
import { screen } from '@testing-library/dom'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, vi } from 'vitest'
import { PrejoinModal } from '@/features/prejoin/prejoin-modal'

describe('PrejoinModal', () => {
  const getUserMediaMock = vi.fn()
  const originalIsSecureContext = window.isSecureContext

  beforeEach(() => {
    getUserMediaMock.mockReset().mockResolvedValue({
      getTracks: () => [{ stop: vi.fn() }],
      getVideoTracks: () => [{ stop: vi.fn() }],
      getAudioTracks: () => []
    })
    Object.defineProperty(window.navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getUserMedia: getUserMediaMock
      }
    })
    Object.defineProperty(window, 'isSecureContext', {
      configurable: true,
      value: true
    })
  })

  afterEach(() => {
    Object.defineProperty(window, 'isSecureContext', {
      configurable: true,
      value: originalIsSecureContext
    })
  })

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

  it('requests preview media when camera preview is enabled', async () => {
    render(<PrejoinModal open onJoin={vi.fn()} />)

    const switches = screen.getAllByRole('switch')
    await userEvent.click(switches[1])

    await waitFor(() => {
      expect(getUserMediaMock).toHaveBeenCalledWith({
        audio: true,
        video: false
      })
      expect(getUserMediaMock).toHaveBeenCalledWith({
        audio: false,
        video: true
      })
    })
  })

  it('does not restart the camera preview when only microphone state changes', async () => {
    render(<PrejoinModal open onJoin={vi.fn()} />)

    const switches = screen.getAllByRole('switch')
    await userEvent.click(switches[1])

    await waitFor(() => {
      expect(getUserMediaMock).toHaveBeenCalledWith({
        audio: true,
        video: false
      })
      expect(getUserMediaMock).toHaveBeenCalledWith({
        audio: false,
        video: true
      })
    })

    const videoCallsBeforeMicToggle = getUserMediaMock.mock.calls.filter(
      ([constraints]) => (constraints as { video?: boolean }).video === true
    ).length
    await userEvent.click(switches[0])

    await waitFor(() => {
      const videoCallsAfterMicToggle = getUserMediaMock.mock.calls.filter(
        ([constraints]) => (constraints as { video?: boolean }).video === true
      ).length
      expect(videoCallsAfterMicToggle).toBe(videoCallsBeforeMicToggle)
    })
  })
})
