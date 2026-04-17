import { createBrowserRouter } from 'react-router-dom'
import { LandingPage } from '@/features/home/landing-page'
import { InvitePage } from '@/features/prejoin/invite-page'
import { RoomPage } from '@/features/room/room-page'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <LandingPage />
  },
  {
    path: '/invite/:token',
    element: <InvitePage />
  },
  {
    path: '/rooms/:roomId',
    element: <RoomPage />
  }
])
